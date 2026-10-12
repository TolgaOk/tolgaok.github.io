# tolgaok.github.io

Personal website, served at [tolgaok.github.io](https://tolgaok.github.io). Built with [Astro](https://astro.build/) and Tailwind, based on [Roman Hauksson's academic project page template](https://github.com/RomanHauksson/academic-project-astro-template).

## Develop

```sh
npm install
npm run dev      # http://localhost:4321, hot reload
npm run build    # type-check + static build into dist/
```

## Checks and interactive figures

```sh
npm test        # numerical and gradient-flow tests
npm run check   # Astro and TypeScript diagnostics
npm run lint    # ESLint
```

With `npm run dev` running, `npm run test:browser` checks the value-gradient
explorer in Chrome, including keyboard controls and desktop/mobile themes.
See [the explorer guide](docs/charts/value-gradients.md) for browser setup and
screenshot checks.

The development-only galleries are `/dev/charts/` and `/dev/value-gradients/`.
New figures should reuse the [shared chart components](docs/charts/README.md).

## Adding a post

Create `src/content/posts/<slug>.mdx`. Plain markdown is sufficient: headings, lists, tables, code fences, `$math$`, and `[@bibkey]` citations (from `bibliography.bib`) all work with no imports. The page appears at `/<kind>/<slug>/` and is listed on the landing page automatically.

```mdx
---
title: My Post
description: One line shown in the landing list.
date: 2026-07-05
kind: research        # or software, or any new kind; each kind becomes a landing section
image: ../../assets/my-post/thumb.png   # optional, small thumbnail in the landing list
draft: true           # optional, hides the post everywhere
---

Content in markdown.
```

Components (hero header with author/link buttons, figures, videos, tabs,
carousels, comparison sliders, two-column layouts) are opt-in; import what
you need. See [`docs/components.md`](docs/components.md) for all of them, and
`src/content/posts/template-demo.mdx` for a live example of everything
(delete that post when it stops being useful).

Post assets go in `src/assets/<slug>/` and are imported from the MDX, so Astro
optimizes them.

## Everything else

- Landing page (bio, buttons, post list, publications): `src/pages/index.astro`
- Publications: edit the `publications` array in `src/pages/index.astro`
- Shared page shell (nav, head, footer): `src/layouts/BaseLayout.astro`
- Shared tab and chart button styling: `src/styles/controls.css`
- Post route: `src/pages/[kind]/[slug].astro`

## Deploy

Push to `main`. GitHub Actions (`.github/workflows/astro.yml`) builds and
publishes to GitHub Pages; the repo's Pages source must be set to "GitHub
Actions". The `github-pages` environment must allow deployments from `main`.

The previous Quartz site is retained on `master`. The Astro migration joins
both Git histories without rewriting either; keep `master` as the old-site
archive and use `main` for Astro development and deployment.
