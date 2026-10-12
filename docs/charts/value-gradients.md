# Value-gradient explorer

The post is `src/content/posts/value-gradients.mdx`.
The isolated development preview is `/dev/value-gradients/`; it is excluded from production builds.

## Source and separation

`src/lib/value-gradients/simulation.mjs` is copied unchanged from
`/Users/tok/research/vectorfield-rl/visualization/simulation.mjs` on 2026-10-08.
The source repository has no commits yet. Keep its numerical tests when updating the copy.
The source project is not a runtime dependency and has not been modified.

- `ValueGradientExplorer.tsx` owns the controls and plot container.
- `src/lib/value-gradients/explorer.mjs` adapts the original renderer with scoped DOM queries and lifecycle cleanup.
- `evaluation.mjs` reuses the simulator's samples, noise pools, and moment accumulator while retaining up to 256 trajectories for the display. The full selected sample budget still determines the estimates; only the visual preview is capped.
- `path-worker.mjs` retains cancellable, progressive ascent computation.
- Shared `charts/streamlines.mjs` adapts the drawing skill's evenly spaced streamline tracer.
- Shared `ChartFrame`, `ChartSelect`, `useChartLayout`, and `ScientificChart.css` own layout, dropdowns, controls, typography, and theme changes. `ChartFrame` accepts an optional `caption` rendered as a semantic `figcaption`; the explorer uses it for a smaller paper-style explanation outside the plot.

Always select `.chart-plot > svg` when mounting. A component can also contain the dropdowns' small SVG icons; selecting the first SVG silently draws the plot into one of those icons.

## Scientific meaning

There is no policy or fitted model in this explorer. All methods estimate the initial-state gradient of a terminal success probability under exact discrete Gaussian transitions. The figure compares REINFORCE and the pathwise estimator, labeled "Value gradient" in the UI. The pathwise estimator integrates the final event analytically rather than differentiating a sampled indicator. The numerical source retains other estimators for derivation checks, but the UI and worker requests exclude them.

The explorer defaults to Inertial well with 64 samples, and Reset restores both. The inertial starting point is `[-0.55, 0.8]`, shifted left from the original almost-certain-success state to show both terminal outcomes. Switching to Inertial well and pressing Home also use this point. The noise scale is fixed at 0.10, time step at 0.02, and horizon at 64. Field, Samples, Step size, and Steps remain adjustable. Step size and Steps are sliders. The two method switches control their ascent curves; there is no separate ascent-paths toggle. The plot has a thin rounded frame matching the control panel and a 0.7 height-to-width ratio. Noise stays fixed until Resample.

No reference curve is displayed or computed. Thick curves are successive changes to the initial state, not process trajectories. Displacements are capped at 0.10 and curves stop at the plotting boundary without projection. Thin process curves show the selected sample count up to a maximum of 256 and are colored by their terminal outcome. Their opacity decreases with sample count to keep the ascent curves legible. The pale background is a reward region, not a basin of attraction.

REINFORCE is dashed red and the value-gradient curve is solid blue, with equal stroke widths. Blue and all control tokens reuse the website's shared scientific-chart style. Drift streamlines have small internal direction chevrons, following the drawing skill's `streamPlot` example. Spacing, arrow sizes, and fixed-point marks use screen pixels so the mobile plot remains legible rather than compressing the desktop density. There are no separate drift-vector or gradient-arrow overlays. Theme changes recolor existing marks without changing the samples or resetting the initial state.

## Trajectory graph

`src/components/ValueGradientGraph.astro` draws the policy, state, action, and
reward dependencies. Its **Compute gradient** switch animates reverse flow using
`src/lib/value-gradients/gradient-flow.mjs`. The schedule waits for downstream and
local reward contributions before propagating through the policy; it illustrates
reverse-mode differentiation rather than computing numerical gradients.

The animation pauses outside the viewport and when the document is hidden.
Reduced-motion mode uses static arrows. On narrow screens, the graph scrolls
horizontally inside its frame. `tests/gradient-flow.test.mjs` checks the schedule
and edge progress.

## Checks

```sh
npm test
npm run check
npm run build
npm run dev
npm run test:browser
node scripts/check-value-gradients-browser.mjs http://127.0.0.1:4321/research/value-gradients/
```

The browser script uses installed Chrome via CDP without an npm browser dependency.
Set `CHROME` to a different executable and `SCREENSHOT_DIR` to change the default `/tmp/value-gradients-shots` destination.
It checks the actual plot's visible dimensions and contents, shared dropdown keyboard interaction, sliders, switches, initial-state keyboard movement, sample budgets, reset, stale worker cancellation, and desktop/mobile light, dark, and device themes.
Inspect the screenshots as well as the assertions. DOM contents alone do not prove that the figure is visible.

The prose checker is
`python3 /Users/tok/.pi/agent/skills/writing-prose/scripts/check.py src/content/posts/value-gradients.mdx`.
Model fitting and fitted-model experiments are deferred.
