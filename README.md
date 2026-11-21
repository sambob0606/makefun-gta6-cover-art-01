[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/sambob0606/makefun-gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/sambob0606/makefun-gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

# Palmline Poster Studio

An offline web app that turns any photo and a caption into GTA-style
multi-panel cover art — the Vice Coast poster look with bold Anton
lettering, a Pacifico script line, and a sunset or neon colour grade —
and exports it as a PNG to share. Built for the
[Make GTA 6 Cover Art](https://make.fun/bounty/gta6-cover-art-01) bounty
on [make.fun](https://make.fun).

## What it does

- **Any photo:** add photos from your device or start with the bundled
  samples. Every photo stays on your machine — nothing is uploaded.
- **Multi-panel covers:** five layouts (Hero split, Four grid, Tilted
  snaps, Full bleed, Triptych). Click a panel to select it, drag the
  photo to reposition it, scroll or use the slider to zoom, and fill
  every panel with one photo or mix several.
- **Colour grades:** Vice Sunset, Neon Night, Palm Gold, Teal Haze and
  Mono Noir — each a gradient wash, tint and photo filter over the panels.
- **Caption:** a big Anton title, a Pacifico script line and a tagline,
  all editable live.
- **Post sizes:** Square 1080 × 1080, Portrait 1080 × 1350 and Wide
  1920 × 1080, exported as a PNG in one click. Grain and vignette finish
  the printed-poster feel.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step,
no network: every script, font and sample photo is a file under `app/`.

To render one cover full-screen for a screenshot, open the app with
`?shot=cover&size=wide` (or `square` / `portrait`), optionally with
`&layout=four-grid&grade=neon-night`. `?shot=editor` opens the editor
with the sample photos already loaded.

## Files

- `app/index.html` — the editor page
- `app/styles.css` — the studio UI
- `app/src/photos.js` — photo loading, tray and per-panel crops
- `app/src/cover.js` — the cover renderer (layouts, grades, lettering)
- `app/src/editor.js` — controls, preview, drag-to-pan, export
- `app/fonts/` — Anton and Pacifico under the SIL Open Font License
- `app/samples/` — sample photos made with an image model for this app
- `main.ts` — the make.fun entry program (copies `app/` + `screenshots/`
  to `/output` and writes `dossier.json`)
- `screenshots/` — the app at work and the covers it exported

## Originality

Everything here is original: the layout, lettering and grades are this
app's own design. No Rockstar Games logo, wordmark, artwork or font is
used anywhere. The fonts are Anton and Pacifico, shipped under the SIL
Open Font License (see `app/fonts/OFL.txt`).

## License

MIT — see [LICENSE](LICENSE).

Made with [make.fun](https://make.fun/r/w3shbtmr).
