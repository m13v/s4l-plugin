// Login setup: the only "getting started" step. Opens the headed persistent
// browser at x.com and reports whether the user's session is logged in.
// Idempotent: call it, and if not logged in the user logs in by hand in the
// already-open window (incl. 2FA), then call it again to confirm. The session
// persists in ~/.s4l-plugin/chrome-profile, so this is a one-time thing.
// No cookie decryption, no Keychain, no network exfil — the user logs into
// their own browser themselves.

import { getPage } from "../browser.mjs";
import { isLoggedIn } from "./gates.mjs";

export async function setupLogin() {
  const page = await getPage({ headed: true });
  await page
    .goto("https://x.com/home", { waitUntil: "domcontentloaded" })
    .catch(() => {});
  await page.bringToFront().catch(() => {});

  // Authoritative check: a real `auth_token` cookie means a real session.
  // We do NOT rely on seeing <main> (the logged-out splash renders it too,
  // which is what caused setup_login to falsely report logged_in:true).
  if (await isLoggedIn(page)) {
    return {
      ok: true,
      logged_in: true,
      message: "Logged in. Session saved — you can discover threads and post.",
    };
  }

  return {
    ok: true,
    logged_in: false,
    message:
      "A Chrome window is open at X and you are NOT logged in yet. Log in there " +
      "yourself (username, password, 2FA) in that window. When your home timeline " +
      "shows, ask me to confirm and I'll re-check.",
  };
}
