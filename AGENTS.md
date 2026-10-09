# Website conventions

## Shared components

Make common styling changes in shared components or configuration, not in individual posts.
Code-block themes and frames are configured in `astro.config.ts`; IPython rendering lives in `src/plugins/ipython.ts`.

## Scientific charts

Use the shared template in `src/components/charts/` for new D3 figures.
Start with [the chart guide](docs/charts/README.md), `ChartFrame.tsx`, and `ScientificChart.css`.
Reuse the layout hook, controls, and drawing helpers rather than copying the JaxDP stylesheet or introducing post-specific style overrides.
Keep dataset-specific code in the consuming chart component.

The runnable examples are at `/dev/charts/` while the development server is running.
Their implementations are `JaxdpPlanningChart.tsx` and `JaxdpVmapBenchmark.tsx`.
Keep this gallery out of production builds.
Check shared changes on desktop and mobile in light and dark themes, including device-theme changes and keyboard interaction.

Preserve the bold scientific style: equal-width curves without markers, aligned end labels, detached axes with outward ticks, major grids, normal-weight axis titles, and labeled color scales.
Use Blues and a font scale of 1.2 for the existing JaxDP figures.

Keep `docs/d3-figures/` ignored and untracked.
Put maintained chart documentation in `docs/charts/`.
