// Gate detection: bail fast (3s) instead of burning time on pages that will
// never let us act. Mirrors the harness's gate-before-draft discipline.

/** Is the page showing a login wall instead of real content? */
export async function isLoginWall(page) {
  if (/\/(login|i\/flow\/login)/.test(page.url())) return true;
  const loginBtn = await page.locator('[data-testid="loginButton"]').count().catch(() => 0);
  const signupBtn = await page.locator('[data-testid="signupButton"]').count().catch(() => 0);
  return loginBtn > 0 || signupBtn > 0;
}

/**
 * Attaches a 429 counter to the page. Call once after creating a page.
 * Returns a getter you can poll: counts() -> { n429 }.
 */
export function watchRateLimit(page) {
  const state = { n429: 0 };
  page.on("response", (res) => {
    if (res.status() === 429) state.n429++;
  });
  return () => ({ ...state });
}

/** Wait for the main timeline/article shell so we don't read a blank SPA. */
export async function waitForShell(page, timeout = 20000) {
  try {
    await page.waitForSelector('main, article[data-testid="tweet"]', {
      state: "attached",
      timeout,
    });
    return true;
  } catch {
    return false;
  }
}
