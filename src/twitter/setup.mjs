// Login setup: the only "getting started" step. Opens the headed persistent
// browser at x.com and reports whether the user's session is logged in.
// Idempotent: call it, and if not logged in the user logs in by hand in the
// already-open window (incl. 2FA), then call it again to confirm. The session
// persists in ~/.s4l-plugin/chrome-profile, so this is a one-time thing.
// No cookie decryption, no Keychain, no network exfil — the user logs into
// their own browser themselves.

import { getPage } from "../browser.mjs";
import { isLoginWall, waitForShell } from "./gates.mjs";

export async function setupLogin() {
  const page = await getPage({ headed: true });
  await page
    .goto("https://x.com/home", { waitUntil: "domcontentloaded" })
    .catch(() => {});
  await page.bringToFront().catch(() => {});

  if (await isLoginWall(page)) {
    return {
      ok: true,
      logged_in: false,
      message:
        "A Chrome window is open at X. Log in there yourself (username, password, 2FA). " +
        "When the home timeline shows, ask me to confirm and I'll re-check.",
    };
  }

  // Not on a login wall — make sure we actually see the timeline shell.
  const ready = await waitForShell(page, 8000);
  return {
    ok: true,
    logged_in: ready,
    message: ready
      ? "Logged in. Session saved — you can discover threads and post."
      : "Couldn't confirm the timeline. If you're not logged in, log in in the open window, then ask me to re-check.",
  };
}
