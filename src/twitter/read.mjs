// read_thread: pull a thread's context so Claude can draft a grounded reply
// instead of replying to a headline it can't see.

import { getPage } from "../browser.mjs";
import { isLoggedIn, isLoginWall, watchRateLimit, waitForShell } from "./gates.mjs";

export async function readThread(url, maxReplies = 8) {
  const page = await getPage();
  const rl = watchRateLimit(page);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});

  if (!(await isLoggedIn(page)) || (await isLoginWall(page))) return { ok: false, error: "login_required" };
  // Wait for an actual tweet article, not just <main> (which is present
  // instantly from the previous page and causes a premature empty read).
  const ok = await page
    .waitForSelector('article[data-testid="tweet"]', { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  if (!ok) return { ok: false, error: "render_timeout", rate_limit: rl().n429 };
  await page.waitForTimeout(1200);

  const data = await page.evaluate((max) => {
    const arts = [...document.querySelectorAll('article[data-testid="tweet"]')];
    const parse = (a) => {
      const link = a.querySelector('a[href*="/status/"]');
      const href = link ? link.getAttribute("href") : "";
      const m = href.match(/\/([^/]+)\/status\/(\d+)/);
      const textEl = a.querySelector('[data-testid="tweetText"]');
      return {
        author: m ? "@" + m[1] : null,
        text: textEl ? textEl.innerText.trim() : "",
      };
    };
    const op = arts.length ? parse(arts[0]) : null;
    const replies = arts.slice(1, 1 + max).map(parse).filter((r) => r.text);
    return { op, replies };
  }, maxReplies);

  return { ok: true, url, ...data, rate_limit: rl().n429 };
}
