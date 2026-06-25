/**
 * WhatsApp ⇄ Claude Code remote-control relay for TravelBoard.
 *
 * Drive this Claude Code session from your phone: message yourself
 * "Claude <instruction>" in WhatsApp and it is injected into the live session;
 * Claude's replies and permission prompts come back to the same chat.
 *
 * Setup:
 *   1. Set CLAUDE_CHANNEL_SECRET in .env (must match scripts/claude-channel.mjs)
 *   2. npm run whatsapp-bot:setup   (first time only — installs Chrome)
 *   3. Start Claude Code with the channel:
 *        claude --dangerously-load-development-channels server:claude-whatsapp
 *   4. npm run whatsapp-bot
 *   5. Scan QR with WhatsApp → Linked devices
 *   6. Message yourself "Claude <instruction>"
 *
 * If you see "browser is already running", run: npm run whatsapp-bot:stop
 */
import fs from "fs";
import os from "os";
import path from "path";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode-terminal";

const { Client, LocalAuth } = pkg;

// Remote-control channel (drive Claude Code from your phone). Must match
// CLAUDE_CHANNEL_SECRET used by scripts/claude-channel.mjs.
const CHANNEL_SECRET = process.env.CLAUDE_CHANNEL_SECRET ?? "";
const CHANNEL_PORT = Number(process.env.CLAUDE_CHANNEL_PORT ?? 8788);
const CHANNEL_BASE = `http://127.0.0.1:${CHANNEL_PORT}`;
// Prefixes the channel uses for outbound messages we relay to WhatsApp; we skip
// these on the way back in so relays don't loop.
const RELAY_MARKERS = ["💬", "🔐"];
// A permission verdict reply, e.g. "yes abcde" (5 letters, never 'l').
const VERDICT_RE = /^\s*(?:y|yes|n|no)\s+[a-km-z]{5}\s*$/i;

if (!CHANNEL_SECRET) {
  console.error("Set CLAUDE_CHANNEL_SECRET in .env (must match scripts/claude-channel.mjs)");
  process.exit(1);
}

function resolveChromeExecutable() {
  const cache = process.env.PUPPETEER_CACHE_DIR ?? path.join(os.homedir(), ".cache", "puppeteer");
  const chromeRoot = path.join(cache, "chrome");
  if (!fs.existsSync(chromeRoot)) return null;

  const versions = fs.readdirSync(chromeRoot).sort().reverse();
  for (const ver of versions) {
    for (const sub of ["chrome-win64", "chrome-win32", "chrome-linux64", "chrome-mac-arm64", "chrome-mac-x64"]) {
      const candidate = path.join(chromeRoot, ver, sub, process.platform === "win32" ? "chrome.exe" : "chrome");
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

const chromePath = resolveChromeExecutable();
if (!chromePath) {
  console.error("Chrome not found. Run: npm run whatsapp-bot:setup");
  process.exit(1);
}

const puppeteer = {
  headless: true,
  executablePath: chromePath,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
};

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: ".whatsapp-auth" }),
  puppeteer,
});

client.on("qr", (qr) => {
  console.log("Scan this QR code with WhatsApp (Linked devices → Link a device):");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("WhatsApp bot ready — Claude remote control ON.");
  console.log('Message yourself "Claude <instruction>" to drive Claude Code.');
  startChannelRelay();
});

client.on("auth_failure", (msg) => {
  console.error("WhatsApp auth failed:", msg);
});

client.on("disconnected", (reason) => {
  console.error("WhatsApp disconnected:", reason);
});

/** Trimmed message body. */
function messageText(msg) {
  return msg.body?.trim() ?? "";
}

async function safeReply(msg, text) {
  try {
    await msg.reply(text);
  } catch (e) {
    console.log("Could not send WhatsApp reply:", String(e));
  }
}

/** Forward an instruction or verdict to the local Claude Code channel. */
async function forwardToChannel(text) {
  try {
    const res = await fetch(`${CHANNEL_BASE}/`, {
      method: "POST",
      headers: { "Content-Type": "text/plain", "X-Channel-Secret": CHANNEL_SECRET },
      body: text,
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch (e) {
    console.error("Channel forward failed:", String(e));
    return false;
  }
}

/** Send Claude's replies / permission prompts to the owner's own WhatsApp chat. */
async function relayToOwner(text) {
  try {
    const selfId = client.info?.wid?._serialized;
    if (!selfId) return;
    await client.sendMessage(selfId, text);
  } catch (e) {
    console.error("Relay to WhatsApp failed:", String(e));
  }
}

/** Subscribe to the channel's SSE stream and relay each message to WhatsApp. */
async function startChannelRelay() {
  console.log(`Claude channel relay: streaming ${CHANNEL_BASE}/events → WhatsApp`);
  for (;;) {
    try {
      const res = await fetch(`${CHANNEL_BASE}/events`);
      if (!res.ok || !res.body) throw new Error(`events ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          for (const line of frame.split("\n")) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const data = t.slice(5).trim();
            if (!data) continue;
            try {
              const { text } = JSON.parse(data);
              if (text) await relayToOwner(text);
            } catch {
              // non-JSON keepalive (": connected") — ignore
            }
          }
        }
      }
    } catch (e) {
      console.error("Channel relay disconnected, retrying in 3s:", String(e));
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
}

async function handleIncomingMessage(msg) {
  const text = messageText(msg);
  if (!text) return;
  // Skip our own relayed messages so they don't loop back into the channel.
  if (RELAY_MARKERS.some((m) => text.startsWith(m))) return;

  // Remote-control: "Claude <instruction>" or a permission verdict ("yes abcde").
  const claudeMatch = /^\s*claude\b[:,]?\s*([\s\S]*)$/i.exec(text);
  if (claudeMatch) {
    const instruction = claudeMatch[1].trim();
    if (!instruction) {
      await safeReply(msg, 'Add an instruction after "Claude". e.g. Claude: list the open TODOs');
      return;
    }
    const ok = await forwardToChannel(instruction);
    await safeReply(
      msg,
      ok
        ? "→ Claude ✓"
        : "⚠️ Claude channel offline. Start the session with: claude --dangerously-load-development-channels server:claude-whatsapp",
    );
    return;
  }

  if (VERDICT_RE.test(text)) {
    await forwardToChannel(text);
    return;
  }

  console.log("Ignored (not a Claude instruction):", text.slice(0, 60) || `[${msg.type}]`);
}

// "message" skips messages you send. message_create catches Message yourself + shares.
client.on("message_create", handleIncomingMessage);

client.initialize().catch((err) => {
  if (String(err?.message ?? err).includes("browser is already running")) {
    console.error("\nA previous bot session is still open.");
    console.error("Run: npm run whatsapp-bot:stop");
    console.error("Then start again: npm run whatsapp-bot\n");
  } else {
    console.error(err);
  }
  process.exit(1);
});
