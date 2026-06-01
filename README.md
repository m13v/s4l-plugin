# social-autoposter

A zero-dependency Twitter/X engagement co-pilot for Claude.

It finds threads worth replying to, drafts a grounded reply in your voice, and
posts it through **your own logged-in browser** after you approve. No Python, no
uv, no database, no system Chrome. Just Node + a bundled Chromium.

## How it works

- **Claude is the brain.** Triage, drafting, and voice live in the skill. The
  conversation model writes the replies.
- **The MCP server is the hands.** Three tools drive a Playwright-bundled Chromium:
  - `discover_threads(query)` — search X's Live tab, return structured candidates
  - `read_thread(url)` — load the OP + top replies so drafts are grounded
  - `post_comment(url, text)` — post an approved reply, return its permalink
- **Your accounts stay on your machine.** Login happens once in a persistent
  Chrome profile at `~/.social-autoposter/chrome-profile`.

## Install

It installs as a Claude plugin. On first install, Node fetches a self-contained
Chromium automatically (`playwright install chromium`). Then connect your account:

```bash
npx social-autoposter connect   # opens a browser, log into X, press Enter
```

## Use

Just talk to Claude:

> find tweets from people frustrated with manual video editing, draft replies, let me approve each

## Requirements

- Node 18+ (already present if you run Claude Code)
- Nothing else. Chromium is fetched at install.

## License

MIT
