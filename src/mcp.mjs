// MCP server: the "hands". Three browser tools. No drafting model here, no DB,
// no scoring. Claude (the conversation) is the brain; this server only acts.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { discoverThreads } from "./twitter/search.mjs";
import { readThread } from "./twitter/read.mjs";
import { postComment } from "./twitter/post.mjs";
import { setupLogin } from "./twitter/setup.mjs";
import { closeBrowser } from "./browser.mjs";

const TOOLS = [
  {
    name: "setup_login",
    description:
      "Getting-started / login check. Opens the headed browser at X and reports whether the user's session is logged in. Call this FIRST before any other tool, and any time a tool reports a login wall. If logged_in is false, tell the user to log in themselves in the open window (incl. 2FA), then call this again to confirm. No arguments.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "discover_threads",
    description:
      "Search X/Twitter's Live tab for recent threads matching a query and return structured candidates (url, author, text, posted_at). Use Twitter search operators freely (e.g. min_faves:5, -filter:replies, lang:en).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Twitter search query, operators allowed." },
        limit: { type: "number", description: "Max threads to return (default 15)." },
      },
      required: ["query"],
    },
  },
  {
    name: "read_thread",
    description:
      "Open a specific tweet URL and return the original post plus top replies so a reply can be grounded in the actual conversation. Call this before drafting.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full tweet URL (https://x.com/<user>/status/<id>)." },
        max_replies: { type: "number", description: "Max replies to include (default 8)." },
      },
      required: ["url"],
    },
  },
  {
    name: "post_comment",
    description:
      "Post a reply to a tweet through the user's own logged-in browser. ONLY call after the user has explicitly approved the exact text. Returns the permalink of the posted reply.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The tweet URL to reply to." },
        text: { type: "string", description: "The exact, user-approved reply text." },
      },
      required: ["url", "text"],
    },
  },
];

const server = new Server(
  { name: "s4l-plugin", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  let result;
  try {
    if (name === "setup_login") {
      result = await setupLogin();
    } else if (name === "discover_threads") {
      result = await discoverThreads(args.query, args.limit ?? 15);
    } else if (name === "read_thread") {
      result = await readThread(args.url, args.max_replies ?? 8);
    } else if (name === "post_comment") {
      result = await postComment(args.url, args.text);
    } else {
      result = { ok: false, error: `unknown_tool:${name}` };
    }
  } catch (e) {
    result = { ok: false, error: "exception", message: String(e?.message || e) };
  }
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

process.on("SIGTERM", async () => { await closeBrowser(); process.exit(0); });
process.on("SIGINT", async () => { await closeBrowser(); process.exit(0); });

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[s4l-plugin] MCP server ready (4 tools).");
