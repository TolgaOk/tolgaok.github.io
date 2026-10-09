# Scientific charts

Use `src/components/charts/` for the shared chart template.
The JaxDP figures are the reference implementations for this style.

## Shared pieces

- `ChartFrame.tsx` provides the figure container, loads the shared CSS, and sets the font scale (default 1.2).
- `ScientificChart.css` owns typography, controls, axes, grids, labels, tooltips, and light/dark themes under `.scientific-chart`.
- `useChartLayout.ts` observes container width, theme changes, and font loading so D3 can redraw.
- `ChartSelect.tsx` provides the accessible dropdown used by chart controls.
- `scientific.ts` provides SVG setup, detached axes, axis titles, color keys, label layout, palettes, and tooltip positioning.

Keep dataset loading and scientific calculations in the consuming component.
Reuse shared pieces instead of copying CSS into a post.
Some helpers in `scientific.ts`, including `CurveSeries`, `CURVE_DASHES`, and `curveLabels`, still use the convergence-data conventions of the reference charts; adapt the data or generalize these helpers when another chart needs them.

## Examples

Run the website and open `/dev/charts/` for both interactive examples.
This route exists only in development and is excluded from production builds.

- `src/components/JaxdpPlanningChart.tsx`: curves, log/linear scales, aligned end labels, and keyboard inspection.
- `src/components/JaxdpVmapBenchmark.tsx`: horizontal bars, capped uncertainty intervals, and a speed color scale.

In an MDX post:

```mdx
import MyChart from "@/components/MyChart";

<MyChart fontScale={1.2} client:load />
```

For a new chart, wrap its controls and `.chart-plot` element in `ChartFrame`.
Attach `useChartLayout` to the plot container and redraw its SVG in an effect when data, width, or the layout revision changes.
Use `useId` for SVG definitions and accessible title/description IDs.
Let React own the container and controls, and D3 own the SVG contents.
Use the two examples above for complete working implementations.

## Visual conventions

- Inherit the website font; keep axis titles and color-key text at normal weight.
- Use equally thick curves without markers, with labels aligned in a common column at the curve ends.
- Leave a small gap between data and axes, with ticks pointing outward.
- Use subdued major grid lines; avoid minor vertical grids.
- Use Blues by default, with an explicit metric-to-color mapping and labeled color key.
- Preserve keyboard controls, visible focus, SVG descriptions, and readable labels on narrow screens.

Check desktop and narrow mobile layouts in light, dark, and device themes after shared changes.
The exploratory `docs/d3-figures/` playground remains ignored by Git; keep committed guidance and examples here instead.
