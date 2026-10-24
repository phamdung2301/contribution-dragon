# 🐉 contribution-dragon

> Your GitHub contribution graph, guarded by an animated dragon.

![demo](demo/dragon-dark.svg)

Zero-dependency TypeScript that renders the GitHub contribution calendar as a
redesigned cell board (rounded corners, glow on peak days, month labels) with
an **animated neon dragon** flying over it — head, flapping wings, dorsal
spikes, fire breath. Pure SMIL, **no JavaScript**, so it animates inside any
GitHub README.

## Use it in your profile

`.github/workflows/dragon.yml`:

```yaml
name: Contribution Dragon
on:
  schedule: [{cron: '23 2 * * *'}]
  workflow_dispatch:
  push: {branches: [main]}
permissions: {contents: write}
jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: phamdung2301/contribution-dragon@main
        with:
          user: YOUR_USERNAME
          token: ${{ secrets.GITHUB_TOKEN }}
          out-dark: dist/dragon-dark.svg
          out-light: dist/dragon-light.svg
      - uses: crazy-max/ghaction-github-pages@v4
        with: {target_branch: output, build_dir: dist}
        env: {GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}}
```

Then embed from the `output` branch:

```html
<img src="https://raw.githubusercontent.com/YOU/YOU/output/dragon-dark.svg" width="100%">
```

## CLI

```bash
npm i -g phamdung2301/contribution-dragon
contribution-dragon --user YOUR_USERNAME --token ghp_xxx --theme dark --out dragon.svg
# hoặc demo không cần token:
contribution-dragon --fixture --theme light --out demo.svg
```

## How it works

1. **Fetch** — one GraphQL call (`contributionsCollection.contributionCalendar`).
2. **Route** — the dragon sweeps the grid **column by column**, alternating
   up/down (boustrophedon). It only ever moves down / right / up — never
   backwards — so the head (rotated along the path via `rotate="auto"`)
   never flips upside down. Empty cells are flown over.
3. **Render** — one SVG path + a chain of *riders* (head, 14 body segments,
   wings, tail) each following the same path with staggered negative
   `begin` offsets, producing the serpentine follow. Flapping wings, dorsal
   spikes and the fire flicker are all SMIL.

## Themes

`dark` (mint on near-black) and `light` — see `demo/`. Board cells are
redesigned: rounded, softer empty state, glow ring behind peak-activity days.

## License

MIT
