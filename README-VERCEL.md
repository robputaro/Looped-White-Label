# Vercel deployment

This package is a zero-build static site.

## GitHub repository layout
Upload the CONTENTS of this folder directly to the repository root. `index.html` and the `assets` folder must be visible at the top level of the repo.

Expected root:
- index.html
- assets/
- looped-wl-tool.html
- logo-resizer.html
- background-generator.html

## Vercel project settings
- Framework Preset: Other
- Root Directory: repository root (the directory containing index.html)
- Build Command: leave blank / disabled
- Output Directory: leave blank
- Install Command: leave blank / default

There is intentionally no vercel.json and no build step. Vercel should serve index.html directly as a static file.
