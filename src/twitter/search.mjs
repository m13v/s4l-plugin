// discover_threads: search X's Live tab and return structured candidates in
// ONE DOM read (the harness trick) instead of screenshot-per-step.

import { getPage } from "../browser.mjs";
import { isLoggedIn, isLoginWall, watchRateLimit, waitForShell } from "./gates.mjs";

/**
 * @param {string} query  raw search query (operators allowed, e.g. "ai agents min_faves:5")
 * @param {number} limit  max threads to return
 * @returns {Promise<{ok:boolean, error?:string, threads?:Array}>}
 */
export async function discoverThreads(query, limit = 15) {
  const page = await getPage();
  const rl = watchRateLimit(page);

  // Live tab = freshest results, matches the pipeline's freshness bias.
  const url = `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});

  if (!(await isLoggedIn(page)) || (await isLoginWall(page))) {
    return { ok: false, error: "login_required", hint: "Call setup_login first: the browser needs you logged into X. A clean empty result here usually means you're logged out, not that there are no threads." };
  }

  // CRITICAL: do NOT scrape on `main` alone — it's present instantly (carried
  // over from the home timeline), so reading here returns 0 before X streams
  // the search results in. Wait for an actual tweet article, or for the
  // explicit empty-state, before deciding there are no results.
  const appeared = await Promise.race([
    page
      .waitForSelector('article[data-testid="tweet"]', { timeout: 20000 })
      .then(() => "tweets")
      .catch(() => null),
    page
      .waitForSelector('[data-testid="empty_state_header_text"]', { timeout: 20000 })
      .then(() => "empty")
      .catch(() => null),
  ]);
  if (appeared === null) {
    return { ok: false, error: "render_timeout", rate_limit: rl().n429 };
  }
  if (appeared === "empty") {
    return { ok: true, query, count: 0, rate_limit: rl().n429, threads: [], note: "X returned no results for this query (genuine empty state)." };
  }
  // Let a few more articles settle past the first before the single DOM read.
  await page.waitForTimeout(1500);

  // Single structured DOM read across rendered tweet articles.
  const threads = await page.evaluate((max) => {
    const out = [];
    const seen = new Set();
    const arts = document.querySelectorAll('article[data-testid="tweet"]');
    for (const a of arts) {
      const link = a.querySelector('a[href*="/status/"]');
      const href = link ? link.getAttribute("href") : null;
      const m = href && href.match(/\/([^/]+)\/status\/(\d+)/);
      if (!m) continue;
      const id = m[2];
      if (seen.has(id)) continue;
      seen.add(id);

      const textEl = a.querySelector('[data-testid="tweetText"]');
      const text = textEl ? textEl.innerText.trim() : "";
      const time = a.querySelector("time");
      out.push({
        url: `https://x.com${href.split("?")[0]}`,
        author: "@" + m[1],
        text,
        posted_at: time ? time.getAttribute("datetime") : null,
      });
      if (out.length >= max) break;
    }
    return out;
  }, limit);

  return { ok: true, query, count: threads.length, rate_limit: rl().n429, threads };
}
