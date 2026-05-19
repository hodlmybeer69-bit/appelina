# Appelina Bananito ($ABC) — Launch Package v2

Ticker: **$ABC**
Domain: **appelina.xyz**
Chain: **Solana**
Launch: **pump.fun**

## What's new in v2 (interactive features)

Based on research into successful Solana meme coin launches (POPCAT, BONK, WIF), three engagement features were added to the site. These are based on patterns that have been proven to drive virality, not random animations.

### 1. 🎮 Fruit Clicker game (POPCAT-style)
A new section between Roadmap and How to Buy. Visitors can click Appelina or Bananito to accumulate clicks. Three stats are tracked:
- **Your Clicks** — personal counter (persistent via localStorage)
- **Global Clicks** — local counter + drifting seed (creates "alive" feeling, not a fake metric claim)
- **Your Team** — which fruit you've clicked more = Apple or Banana

A "Share my fruit count" button generates a pre-filled tweet so users naturally amplify the brand. This is the same playbook POPCAT used to reach $1B market cap.

### 2. 🍎🍌 Cursor fruit trail
On desktop, small fruit emojis fall from the cursor as it moves (throttled, with reduced-motion respect). On mobile, this is disabled to avoid jank. Doesn't trigger on buttons/links to keep interaction clean.

### 3. ✨ Hero floating emojis + scroll reveals
Background fruit emojis drift behind the hero. Stats cards in the clicker section fade-in on scroll. Existing scroll reveals on lore/tokenomics/roadmap remain.

All animations honor `prefers-reduced-motion` for accessibility.

## What's in this folder

```
index.html        ← Landing page with all features
vercel.json       ← Vercel config (security headers + clean URLs)
robots.txt        ← SEO crawler rules
sitemap.xml       ← For search engines
og-image.png      ← 1200x630 social share image
og-image.svg      ← Editable source
logo.png          ← Hero logo
favicon.png       ← Browser tab icon (256x256)
README.md         ← This file
```

## Deploy via GitHub → Vercel (recommended)

### One-time setup
1. **Create a GitHub repo** (e.g. `appelina-bananito`)
2. **Upload these files** to the repo root
3. **Connect to Vercel**: Vercel dashboard → "Add New" → "Project" → import repo
4. Vercel auto-detects static site. Click Deploy.
5. **Domain**: Vercel project → Settings → Domains → Add `appelina.xyz`

### Updates after launch
```bash
git add index.html
git commit -m "update CA"
git push
```
Vercel auto-deploys within 30 seconds.

## Pre-launch checklist — replace these placeholders

Open `index.html` and replace:

| What | Search for | Replace with |
|---|---|---|
| Twitter link | `id="link-twitter"` href="#" | Your Twitter URL |
| Telegram link | `id="link-telegram"` href="#" | Your t.me link |
| TikTok link | `id="link-tiktok"` href="#" | Your TikTok URL |
| Pump.fun link (button) | `id="pumpfun-btn"` href="#" | Your pump.fun token URL |
| Pump.fun link (card) | `id="link-pumpfun"` href="#" | Same pump.fun URL |
| DexScreener (button) | `id="dexscreener-btn"` href="#" | Your DexScreener URL |
| Contract Address | `id="ca"` | Real contract address |
| Share-tweet handle | `@appelinabananito` (in JS at bottom) | Your real handle if different |

## Browser compatibility

- ✅ Chrome, Edge, Firefox, Safari (desktop + mobile)
- ✅ localStorage persistence works in all modern browsers
- ⚠️ Private/Incognito mode: counter resets per session (expected behavior)
- ⚠️ Cursor trail only on devices with hover + fine pointer (skips touchscreens — by design)

## Performance notes

- Single HTML file, no build step, ~33KB total
- No external JS libraries (vanilla)
- Only Google Fonts loaded externally
- Particle limit per second: ~12 (throttled at 80ms)
- localStorage usage: <1KB
