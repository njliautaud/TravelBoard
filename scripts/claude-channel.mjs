/**
 * Claude Code "channel" bridge for TravelBoard (research preview).
 *
 * Lets you drive THIS Claude Code session from your phone over WhatsApp:
 *   phone → WhatsApp self-chat ("Claude ...") → whatsapp-bot.mjs → POST here
 *     → notification pushed into the live Claude Code session → Claude acts.
 *   Claude's replies + permission prompts → SSE /events → whatsapp-bot.mjs
 *     → WhatsApp self-chat → your phone.
 *
 * This file is spawned BY Claude Code as an MCP server over stdio (see .mcp.json).
 * Do NOT write to stdout — that's the MCP transport. All logs go to stderr.
 *
 * Activate (Claude Code must be ≥ v2.1.80; permission relay ≥ v2.1.81):
 *   claude --dangerously-load-development-channels server:claude-whatsapp
 *
 * Security:
 *   - HTTP listener binds to 127.0.0.1 only (nothing off-machine can reach it).
 *   - Every inbound POST must carry X-Channel-Secret === CLAUDE_CHANNEL_SECRET.
 *   - Permission relay is enabled: file writes / shell commands still require a
 *     "yes <id>" approval (from the terminal OR your phone). Run the session in
 *     the DEFAULT permission mode — do NOT use --dangerously-skip-permissions,
 *     or remote messages could act without any approval.
 */
import http from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const PORT = Number(process.env.CLAUDE_CHANNEL_PORT ?? 8788);
const SECRET = process.env.CLAUDE_CHANNEL_SECRET ?? "";
const SERVER_NAME = "claude-whatsapp";

if (!SECRET) {
  console.error("[claude-channel] CLAUDE_CHANNEL_SECRET is not set — refusing to start.");
  console.error("[claude-channel] Add CLAUDE_CHANNEL_SECRET=<random-string> to .env");
  process.exit(1);
}

// --- Outbound: broadcast to every SSE listener on GET /events ---------------
const listeners = new Set();
function broadcast(text) {
  const payload = `data: ${JSON.stringify({ text })}\n\n`;
  for (const res of listeners) {
    try {
      res.write(payload);
    } catch {
      listeners.delete(res);
    }
  }
}

// --- MCP server: declare the channel + permission relay + a reply tool -------
const mcp = new Server(
  { name: SERVER_NAME, version: "0.1.0" },
  {
    capabilities: {
      experimental: {
        "claude/channel": {}, // registers the notification listener (required)
        "claude/channel/permission": {}, // forward tool-approval prompts to the phone
      },
      tools: {}, // expose the reply tool below
    },
    instructions:
      'Messages from the WhatsApp owner arrive as <channel source="claude-whatsapp" ...>. ' +
      "Treat them as instructions to act on this TravelBoard repo. When you have a result, " +
      "a question, or are done, call the `reply` tool with a short `text` so it reaches the " +
      "owner's phone (they cannot see this terminal). Keep replies concise — they show in WhatsApp.",
  },
);

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "reply",
      description:
        "Send a short message back to the WhatsApp owner's phone (status, result, or a question).",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "The message to send to the phone" },
        },
        required: ["text"],
      },
    },
  ],
}));

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name === "reply") {
    const { text } = req.params.arguments ?? {};
    broadcast(`💬 ${String(text ?? "")}`);
    return { content: [{ type: "text", text: "sent" }] };
  }
  throw new Error(`unknown tool: ${req.params.name}`);
});

// Permission relay: Claude Code calls this when a tool needs approval.
const PermissionRequestSchema = z.object({
  method: z.literal("notifications/claude/channel/permission_request"),
  params: z.object({
    request_id: z.string(),
    tool_name: z.string(),
    description: z.string(),
    input_preview: z.string().optional(),
  }),
});

mcp.setNotificationHandler(PermissionRequestSchema, async ({ params }) => {
  const preview = params.input_preview ? `\n${params.input_preview}` : "";
  broadcast(
    `🔐 Claude wants to run ${params.tool_name}: ${params.description}${preview}\n\n` +
      `Reply "yes ${params.request_id}" or "no ${params.request_id}"`,
  );
});

await mcp.connect(new StdioServerTransport());
console.error(`[claude-channel] connected to Claude Code over stdio as "${SERVER_NAME}"`);

// --- HTTP on 127.0.0.1:PORT: GET /events streams out, POST routes inbound ----
// "yes abcde" / "no abcde" (5 letters, never 'l') — a permission verdict.
const VERDICT_RE = /^\s*(y|yes|n|no)\s+([a-km-z]{5})\s*$/i;

const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  // Outbound stream for the WhatsApp bot to relay to the phone.
  if (req.method === "GET" && url.pathname === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(": connected\n\n");
    listeners.add(res);
    req.on("close", () => listeners.delete(res));
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405).end("method not allowed");
    return;
  }

  // Every inbound message must prove it's from our bot (shared secret).
  if (req.headers["x-channel-secret"] !== SECRET) {
    res.writeHead(403).end("forbidden");
    return;
  }

  let body = "";
  req.on("data", (c) => {
    body += c;
    if (body.length > 8192) req.destroy(); // bound the buffer
  });
  req.on("end", async () => {
    const text = body.trim();
    if (!text) {
      res.writeHead(400).end("empty");
      return;
    }

    // A verdict reply ("yes abcde") goes to Claude Code, not to Claude as chat.
    const m = VERDICT_RE.exec(text);
    if (m) {
      await mcp.notification({
        method: "notifications/claude/channel/permission",
        params: {
          request_id: m[2].toLowerCase(),
          behavior: m[1].toLowerCase().startsWith("y") ? "allow" : "deny",
        },
      });
      res.writeHead(200).end("verdict recorded");
      return;
    }

    // Normal instruction: inject into the live Claude Code session.
    await mcp.notification({
      method: "notifications/claude/channel",
      params: { content: text, meta: { source_app: "whatsapp" } },
    });
    res.writeHead(200).end("ok");
  });
});

httpServer.on("error", (e) => {
  console.error(`[claude-channel] HTTP error: ${String(e)}`);
  if (e && e.code === "EADDRINUSE") {
    console.error(`[claude-channel] Port ${PORT} is in use — is another channel running?`);
    process.exit(1);
  }
});

httpServer.listen(PORT, "127.0.0.1", () => {
  console.error(`[claude-channel] listening on http://127.0.0.1:${PORT} (POST=inbound, GET /events=outbound)`);
});
