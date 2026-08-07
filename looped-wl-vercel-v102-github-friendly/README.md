# Looped Clinic White Labeling Tool

## Files

### looped-wl-tool.html (MAIN — unified dashboard)
All three tools combined in one file. Open in any browser, no install required.
- **Tab 1: Logo Resizer** — fit+pad PNGs to App (2048×2048), wide/logo sizes (1920×1080, 600×160, Header 800×220), Hero (3840×2160). Includes: background removal (global color-key, tolerance slider with live preview), crop-to-content, extend-background-to-fill.
- **Tab 2: Background Generator** — 2160×3840 (9:16, 4K vertical) atmospheric gradients. Atmospheric mode derives 4 tones from brand color using pixel-level diagonal S-curve ramp. Classic mode: 4 linear gradient styles. Includes optional premium contour texture overlay.
- **Tab 3: Hero Card Composer** — 560×320 card exported at 2× (1120×640). Uploads: clinic logo (auto-crops, auto-extracts brand color), optional decorative image with zoom/pan, or AI-generate emblem via Anthropic API. Card has premium brand tint, 3D bevel shadow, and a rebuilt procedural silk/topographic contour texture system.

### logo-resizer.html (standalone)
Same as Tab 1 above, as a standalone file.

### background-generator.html (standalone)
Same as Tab 2 above, as a standalone file.

---

## Premium Contour Texture System
The previous sparse arc texture has been replaced with a procedural contour/silk-line renderer. It draws dense, ultra-thin, low-opacity parallel paths from a shared organic field, so the output stays premium and subtle instead of becoming random line art.

Available texture styles:
- **Silk Contour Flow** — best default for the Lumina-style card
- **Topographic Wave Lines** — more contour-map movement
- **Ambient Ripple Field** — softer diagonal movement
- **Soft Relief Lines** — quieter, broader bands
- **Minimal Frosted Lines** — lowest-visibility premium texture

Recommended strength range: **40–75%**. Push to 90–120% only when you need a visible internal test preview.

---

## Export Filenames
All tools auto-name exports as:
- `{clinic}_app_{country}.png`
- `{clinic}_wide_1920x1080_{country}.png`
- `{clinic}_hero_card_{country}.png`
- `{clinic}_background_{country}.png`

## Tech Stack
- Pure HTML/CSS/JS — no framework, no build step, no server
- JSZip (CDN) for batch ZIP downloads in Logo Resizer
- Google Fonts: Cormorant Garamond + DM Serif Display (for hero card headline)
- Anthropic API (claude-sonnet-4-6) for AI emblem generation in Hero Card tab
- All canvas operations use native browser Canvas 2D API
