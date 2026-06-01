// post_comment: post a reply, then read the FINAL URL as the success signal
// (not a flat sleep). Selectors mirror the proven harness:
//   reply box   -> [data-testid="tweetTextarea_0"]
//   submit      -> [data-testid="tweetButtonInline"]  (fallback Meta+Enter)
//   login wall  -> [data-testid="loginButton"]

import { getPage } from "../browser.mjs";
import { isLoggedIn, isLoginWall, watchRateLimit, waitForShell } from "./gates.mjs";

const REPLY_BOX = [
  '[data-testid="tweetTextarea_0"]',
  '[role="textbox"][aria-label="Post text"]',
  '[role="textbox"][aria-label="Post your reply"]',
  '[role="textbox"][aria-label="Tweet your reply"]',
];

async function findReplyBox(page, timeout = 45000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const sel of REPLY_BOX) {
      const loc = page.locator(sel).first();
      if (await loc.count().catch(() => 0)) return loc;
    }
    await page.waitForTimeout(500);
  }
  return null;
}

export async function postComment(url, text) {
  if (!text || !text.trim()) return { ok: false, error: "empty_text" };
  const page = await getPage();
  const rl = watchRateLimit(page);

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
  if (!(await isLoggedIn(page)) || (await isLoginWall(page))) return { ok: false, error: "login_required" };
  if (!(await waitForShell(page))) return { ok: false, error: "render_timeout", rate_limit: rl().n429 };

  const box = await findReplyBox(page);
  if (!box) return { ok: false, error: "reply_box_not_found", rate_limit: rl().n429 };

  await box.click();
  await page.keyboard.type(text, { delay: 10 }); // human-ish cadence

  // Submit: inline button is the correct target (NOT the top-right composer button).
  const submit = page.locator('[data-testid="tweetButtonInline"]').first();
  if (await submit.count().catch(() => 0)) {
    await submit.click();
  } else {
    await page.keyboard.press("Meta+Enter");
  }

  // Success = the composer tears down and a fresh permalink to our reply appears.
  await page.waitForTimeout(2500);
  if (rl().n429 > 0) return { ok: false, error: "rate_limited", rate_limit: rl().n429 };

  const replyUrl = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href*="/status/"]')]
      .map((a) => a.getAttribute("href"))
      .filter(Boolean);
    return links[0] ? "https://x.com" + links[0].split("?")[0] : null;
  });

  return { ok: true, parent: url, reply_url: replyUrl, rate_limit: rl().n429 };
}
