/**
 * WhatsApp ingestion bot for TravelBoard.
 *
 * Setup:
 *   1. Set WHATSAPP_INGEST_KEY and WHATSAPP_OWNER_USERNAME in .env
 *   2. npm run whatsapp-bot:setup   (first time only — installs Chrome)
 *   3. npm run dev                  (keep running in another terminal)
 *   4. npm run whatsapp-bot
 *   5. Scan QR with WhatsApp → Linked devices
 *   6. Message yourself with a link — it lands in Draft inbox
 *
 * If you see "browser is already running", run: npm run whatsapp-bot:stop
 */
import fs from "fs";
import os from "os";
import path from "path";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode-terminal";

const { Client, LocalAuth } = pkg;

const API = process.env.TRAVELBOARD_API ?? "http://localhost:3000";
const INGEST_KEY = process.env.WHATSAPP_INGEST_KEY;
const OWNER = process.env.WHATSAPP_OWNER_USERNAME ?? "swann";

if (!INGEST_KEY) {
  console.error("Set WHATSAPP_INGEST_KEY in .env");
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

async function checkApi() {
  try {
    const res = await fetch(`${API}/api/auth/me`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      console.warn(`Warning: TravelBoard at ${API} returned ${res.status}. Is npm run dev running?`);
      return;
    }
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("json")) {
      console.warn(
        `Warning: ${API} did not return JSON (got ${ct}). Another app may be using that port — check TRAVELBOARD_API in .env`
      );
    } else {
      console.log(`TravelBoard API OK at ${API}`);
    }
  } catch (e) {
    console.error(`Cannot reach TravelBoard at ${API} — start npm run dev first (${String(e)})`);
  }
}

client.on("ready", () => {
  console.log(`WhatsApp bot ready — forwarding to ${API} for user "${OWNER}"`);
  checkApi();
});

client.on("auth_failure", (msg) => {
  console.error("WhatsApp auth failed:", msg);
});

client.on("disconnected", (reason) => {
  console.error("WhatsApp disconnected:", reason);
});

const BOT_REPLY = "Saved to TravelBoard draft inbox ✓";
const URL_RE =
  /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;

/** Body text, or URLs from link-preview messages where body can be empty. */
function messageText(msg) {
  const body = msg.body?.trim() ?? "";
  if (body) return body;
  const links = (msg.links ?? [])
    .map((l) => (typeof l === "string" ? l : l?.link))
    .filter(Boolean);
  if (links.length) return links.join("\n");
  return "";
}

function extractUrls(text) {
  return [...text.matchAll(URL_RE)].map((m) => m[0]);
}

const recentUrls = new Map();
function seenRecently(url) {
  const now = Date.now();
  for (const [k, t] of recentUrls) {
    if (now - t > 60_000) recentUrls.delete(k);
  }
  if (recentUrls.has(url)) return true;
  recentUrls.set(url, now);
  return false;
}

async function handleIncomingMessage(msg) {
  const text = messageText(msg);
  if (!text || text.includes(BOT_REPLY)) return;

  const urls = extractUrls(text);
  if (!urls.length) {
    console.log("Ignored (no URL):", text.slice(0, 60) || `[${msg.type}]`);
    return;
  }

  const url = urls[0];
  if (seenRecently(url)) return;

  try {
    const res = await fetch(`${API}/api/drafts/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Ingest-Key": INGEST_KEY,
      },
      body: JSON.stringify({ text, username: OWNER, source: "whatsapp" }),
    });

    const raw = await res.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      console.error(
        `Ingest failed: ${API} returned non-JSON (status ${res.status}).`,
        "Is npm run dev running on the correct port? Set TRAVELBOARD_API in .env if not 3000."
      );
      return;
    }

    if (res.ok) {
      console.log("Draft saved:", data.draft?.id ?? "ok", "←", text.slice(0, 80));
      try {
        await msg.reply(BOT_REPLY);
      } catch (e) {
        console.log("Draft saved but could not send WhatsApp reply:", String(e));
      }
    } else {
      console.error("Ingest failed:", data);
    }
  } catch (e) {
    console.error("Ingest error:", e);
  }
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
