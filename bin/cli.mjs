#!/usr/bin/env node
// CLI entry. Subcommands:
//   mcp               -> start the MCP server (what .mcp.json launches)
//   install-chromium  -> fetch Playwright's bundled Chromium (postinstall)
//   connect           -> open a headed browser so the user logs into X once
//   doctor            -> verify node + chromium are ready

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const cmd = process.argv[2];

function installChromium() {
  // Pure-Node: downloads a self-contained Chromium. No uv, no Python, no system Chrome.
  const r = spawnSync("npx", ["playwright", "install", "chromium"], {
    stdio: "inherit",
    cwd: ROOT,
    shell: process.platform === "win32",
  });
  process.exit(r.status ?? 0);
}

async function connect() {
  const { getPage, closeBrowser } = await import("../src/browser.mjs");
  const page = await getPage({ headed: true });
  await page.goto("https://x.com/home", { waitUntil: "domcontentloaded" }).catch(() => {});
  console.log("\nA browser window opened. Log into X/Twitter, then press Enter here to save the session.");
  process.stdin.resume();
  await new Promise((res) => process.stdin.once("data", res));
  await closeBrowser();
  console.log("Session saved. You can now discover and post.");
  process.exit(0);
}

function doctor() {
  console.log("node:", process.version);
  const r = spawnSync("npx", ["playwright", "--version"], { encoding: "utf8", cwd: ROOT, shell: process.platform === "win32" });
  console.log("playwright:", (r.stdout || r.stderr || "not found").trim());
  process.exit(0);
}

if (cmd === "mcp") {
  await import("../src/mcp.mjs");
} else if (cmd === "install-chromium") {
  installChromium();
} else if (cmd === "connect") {
  await connect();
} else if (cmd === "doctor") {
  doctor();
} else {
  console.log("Usage: s4l-plugin <mcp|connect|install-chromium|doctor>");
  process.exit(1);
}
