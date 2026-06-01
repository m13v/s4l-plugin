// Persistent Chromium launcher.
// Saved user-data dir so the user logs into their own Twitter ONCE and the
// session survives across runs. No system Chrome, no CDP-port dance, no Python.
//
// Chromium is NOT bundled in the plugin zip: a full browser (~341MB unpacked)
// blows past the 200MB *uncompressed* cap on the Claude plugin uploader. Instead
// we fetch it once on first launch into Playwright's standard global cache
// (~/.cache/ms-playwright), so it persists across the machine and every later
// launch is instant.

import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROFILE_DIR = path.join(os.homedir(), ".s4l-plugin", "chrome-profile");

let _context = null;
let _ensured = false;

// Fetch Chromium on first run if it isn't on this machine yet.
function ensureChromium() {
  if (_ensured) return;
  let installed = false;
  try {
    const p = chromium.executablePath(); // throws if not installed
    installed = !!p && existsSync(p);
  } catch {
    installed = false;
  }
  if (!installed) {
    // stdio -> stderr so it never corrupts the MCP stdout JSON-RPC stream.
    process.stderr.write(
      "[s4l-plugin] Chromium not found, downloading once (~150MB, one-time)...\n"
    );
    const r = spawnSync(
      "node",
      [path.join(ROOT, "node_modules", "playwright-core", "cli.js"), "install", "chromium"],
      { stdio: ["ignore", 2, 2], cwd: ROOT }
    );
    if ((r.status ?? 1) !== 0) {
      throw new Error(
        "Chromium download failed. Run `node bin/cli.mjs install-chromium` manually, then retry."
      );
    }
    process.stderr.write("[s4l-plugin] Chromium ready.\n");
  }
  _ensured = true;
}

/**
 * Returns a live persistent BrowserContext, launching it on first call.
 * headed:true so the user can complete login / 2FA on first run.
 */
export async function getContext({ headed = true } = {}) {
  if (_context && _context.browser()?.isConnected?.() !== false) return _context;
  ensureChromium();
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  _context = await chromium.launchPersistentContext(PROFILE_DIR, {
    // channel:"chromium" runs the FULL Chromium in new-headless mode (no separate
    // chrome-headless-shell binary needed).
    channel: "chromium",
    headless: !headed,
    viewport: { width: 1280, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
  });
  return _context;
}

/** Returns the first usable page (reuses an open one, else opens a tab). */
export async function getPage(opts) {
  const ctx = await getContext(opts);
  const pages = ctx.pages();
  return pages.length ? pages[0] : await ctx.newPage();
}

export async function closeBrowser() {
  if (_context) {
    await _context.close().catch(() => {});
    _context = null;
  }
}
