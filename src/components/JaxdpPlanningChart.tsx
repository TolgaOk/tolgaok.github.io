import { useEffect, useId, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

import data from "@/assets/jaxdp/planning-comparison.json";
import ChartSelect from "./charts/ChartSelect";
import useChartLayout from "./charts/useChartLayout";
import {
  AXIS_GAP,
  LOG_FLOOR,
  CURVE_DASHES,
  axesFrame,
  axisTitle,
  bluesPalette,
  colorKey,
  curveLabels,
  figure,
  fitAxisTicks,
  formatValue,
  positionTooltip,
  power,
} from "./charts/scientific";
import type { ChartPoint, ChartScale, CurveSeries } from "./charts/scientific";
import ChartFrame from "./charts/ChartFrame";

type Metric = "residual" | "error";
const ENVIRONMENT_OPTIONS = data.environments.map((environment) => ({
  value: environment.id,
  label: environment.label,
}));
const METRIC_OPTIONS = [
  { value: "residual", label: "Residual" },
  { value: "error", label: "Value error" },
];

export default function JaxdpPlanningChart({
  fontScale = 1,
}: {
  fontScale?: number;
}) {
  const [environmentId, setEnvironmentId] = useState("garnet-medium");
  const [metric, setMetric] = useState<Metric>("residual");
  const [logX, setLogX] = useState(true);
  const [logY, setLogY] = useState(true);
  const [selected, setSelected] = useState("safe-anderson-vi");
  const plotRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { width, revision } = useChartLayout(plotRef);
  const chartId = `jaxdp-planning-${useId().replaceAll(":", "")}`;
  const environment = useMemo(
    () =>
      data.environments.find((candidate) => candidate.id === environmentId) ??
      data.environments[0],
    [environmentId],
  );

  useEffect(() => {
    const svgElement = svgRef.current,
      tooltipElement = tooltipRef.current;
    if (!svgElement || !tooltipElement || width === 0) return;
    const focusedMethod = svgElement
      .querySelector(":focus")
      ?.getAttribute("data-method");
    tooltipElement.style.display = "none";
    const narrow = width < 610,
      height = narrow ? 412 : 474;
    const margin = {
      left: (narrow ? 54 : 96) + AXIS_GAP,
      right: narrow ? 116 : 180,
      top: narrow ? 102 : 68,
      bottom: 64 + AXIS_GAP,
    };
    const w = Math.max(1, width - margin.left - margin.right),
      h = height - margin.top - margin.bottom;
    const background = getComputedStyle(svgElement)
      .getPropertyValue("--chart-canvas")
      .trim();
    const palette = bluesPalette(background);
    const metricLabel =
      metric === "residual" ? "Bellman residual" : "Value error";
    const value = (point: ChartPoint) => point[metric];
    const finalBounds: [number, number] = [
      LOG_FLOOR,
      d3.max(
        data.environments.flatMap((env) =>
          env.series.map((series) =>
            Math.max(LOG_FLOOR, value(series.points.at(-1)!)),
          ),
        ),
      )!,
    ];
    const finalScale = d3
      .scaleLog()
      .domain(finalBounds)
      .range([1, 0])
      .clamp(true);
    const curveColor = (series: CurveSeries) =>
      palette(finalScale(Math.max(LOG_FLOOR, value(series.points.at(-1)!))));
    const values = environment.series.flatMap((series) =>
      series.points.map(value),
    );
    const hasFloor = values.some((v) => v <= LOG_FLOOR);
    const lower = Math.floor(Math.log10(Math.max(LOG_FLOOR, d3.min(values)!)));
    const upper = Math.max(
      lower + 1,
      Math.ceil(Math.log10(Math.max(LOG_FLOOR, d3.max(values)!))),
    );
    const x: ChartScale = (logX ? d3.scaleLog() : d3.scaleLinear())
      .domain([1, data.metadata.maxUpdates])
      .range([0, w]);
    const y: ChartScale = logY
      ? d3
          .scaleLog()
          .domain([10 ** lower, 10 ** upper])
          .range([h, 0])
      : d3
          .scaleLinear()
          .domain([0, (d3.max(values) || 1) * 1.05])
          .nice()
          .range([h, 0]);
    const stride = [1, 2, 4, 5, 8].find((n) => n >= (upper - lower) / 5) || 10;
    const exponents = d3.range(
      Math.ceil(lower / stride) * stride,
      upper + 1,
      stride,
    );
    if (!exponents.includes(lower)) exponents.unshift(lower);
    const yTicks = logY ? exponents.map((n) => 10 ** n) : y.ticks(5);
    const xTicks = logX
      ? [1, 10, 100, data.metadata.maxUpdates]
      : [
          1,
          ...x
            .ticks(narrow ? 3 : 5)
            .filter((n) => n > 1 && n < data.metadata.maxUpdates),
          data.metadata.maxUpdates,
        ];
    const minorX: number[] = [];
    if (logX)
      for (let magnitude = 1; magnitude <= 100; magnitude *= 10) {
        for (let factor = 1; factor < 10; factor++) {
          const n = magnitude * factor;
          if (n < data.metadata.maxUpdates && !xTicks.includes(n))
            minorX.push(n);
        }
      }
    const minorY = logY
      ? d3
          .range(lower, upper + 1)
          .filter((n) => !exponents.includes(n))
          .map((n) => 10 ** n)
      : [];
    const svg = figure(
      svgElement,
      width,
      height,
      chartId,
      `${metricLabel} on ${environment.label}`,
      `Four planners over ${data.metadata.maxUpdates} updates. The x-axis is ${logX ? "logarithmic" : "linear"}; the y-axis is ${logY ? "logarithmic" : "linear"}. Blues colors encode the final ${metric === "residual" ? "residual" : "value error"} on a fixed logarithmic scale across environments. ${logY ? "Curves stop at entry into values at or below 10⁻¹⁶; flat tails are omitted." : "Zero values are shown at zero."} Labels connect to visible curve endpoints. Focus the plot and use arrow keys, Home, or End to inspect recorded updates.`,
    );
    const root = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    colorKey(svg, {
      id: `${chartId}-key`,
      width,
      left: margin.left,
      plotWidth: w,
      narrow,
      top: narrow ? 34 : 0,
      low: "Higher",
      high: "Lower",
      title: metric === "residual" ? "Final residual" : "Final error",
      color: palette,
      description: `Blues encodes ${metricLabel.toLowerCase()} after ${data.metadata.maxUpdates} updates on a fixed logarithmic scale across environments; darker blue indicates lower values. The lower endpoint includes values at or below 10⁻¹⁶.`,
    });
    axesFrame(root, w, 0, h);
    root
      .append("g")
      .attr("class", "grid")
      .call(
        d3
          .axisLeft(y)
          .tickValues(
            yTicks.filter((n) => n > y.domain()[0] && n < y.domain()[1]),
          )
          .tickSize(-w)
          .tickFormat(() => ""),
      );
    root
      .append("g")
      .attr("class", "grid convergence-grid-x")
      .selectAll("line")
      .data(xTicks.filter((n) => n > 1 && n < data.metadata.maxUpdates))
      .join("line")
      .attr("data-update", (n) => n)
      .attr("x1", (n) => x(n))
      .attr("x2", (n) => x(n))
      .attr("y1", 0)
      .attr("y2", h);
    root
      .append("g")
      .attr("class", "axis scientific-y-axis")
      .attr("transform", `translate(${-AXIS_GAP},0)`)
      .call(
        d3
          .axisLeft(y)
          .tickValues(yTicks)
          .tickSize(6)
          .tickPadding(4)
          .tickFormat((n) =>
            logY
              ? (hasFloor && +n === LOG_FLOOR ? "≤" : "") + power(n)
              : d3.format(".2~g")(+n),
          ),
      );
    root
      .append("g")
      .attr("class", "axis scientific-x-axis")
      .attr("transform", `translate(0,${h + AXIS_GAP})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(xTicks)
          .tickSize(6)
          .tickPadding(6)
          .tickFormat(d3.format("~g")),
      )
      .call(fitAxisTicks);
    root
      .append("g")
      .attr("class", "minor-axis")
      .attr("transform", `translate(0,${h + AXIS_GAP})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(minorX)
          .tickSize(3)
          .tickFormat(() => ""),
      );
    root
      .append("g")
      .attr("class", "minor-axis")
      .attr("transform", `translate(${-AXIS_GAP},0)`)
      .call(
        d3
          .axisLeft(y)
          .tickValues(minorY)
          .tickSize(3)
          .tickFormat(() => ""),
      );
    axisTitle(root, w / 2, h + AXIS_GAP + 52, "Updates, ", "k");
    const math = metric === "residual" ? "‖TVₖ − Vₖ‖∞" : "‖Vₖ − V*‖∞";
    if (narrow) axisTitle(svg, 0, 19, `${metricLabel}, `, math, "start");
    else
      axisTitle(root, 0, 0, `${metricLabel}, `, math).attr(
        "transform",
        `translate(${-margin.left + 14},${h / 2}) rotate(-90)`,
      );
    svg
      .append("defs")
      .append("clipPath")
      .attr("id", `${chartId}-clip`)
      .append("rect")
      .attr("x", -4)
      .attr("y", -4)
      .attr("width", w + 8)
      .attr("height", h + 8);
    const marks = root.append("g").attr("clip-path", `url(#${chartId}-clip)`);
    const line = d3
      .line<ChartPoint>()
      .defined(
        (point, index, points) =>
          !logY ||
          value(point) > LOG_FLOOR ||
          (index > 0 && value(points[index - 1]) > LOG_FLOOR) ||
          (index + 1 < points.length && value(points[index + 1]) > LOG_FLOOR),
      )
      .x((point) => x(point.update))
      .y((point) => y(logY ? Math.max(LOG_FLOOR, value(point)) : value(point)));
    marks
      .selectAll(".trace")
      .data(environment.series)
      .join("path")
      .attr("class", "trace")
      .attr("data-method", (series) => series.algorithm)
      .attr("d", (series) => line(series.points))
      .attr("stroke", curveColor)
      .attr("stroke-width", 3)
      .attr("stroke-dasharray", (series) => CURVE_DASHES[series.algorithm]);

    const tooltip = d3.select(tooltipElement);
    tooltip.selectAll("*").remove();
    const heading = tooltip.append("p");
    const tooltipRows = environment.series.map((series) => {
      const row = tooltip.append("div");
      row.append("span").text(series.label);
      return row.append("strong");
    });
    const inspection = root
      .append("line")
      .attr("class", "inspect-rule")
      .attr("y1", 0)
      .attr("y2", h)
      .style("display", "none");
    let pointIndex = 0;
    const overlay = root
      .append("rect")
      .attr("class", "chart-overlay")
      .attr("width", w)
      .attr("height", h)
      .attr("role", "slider")
      .attr("tabindex", 0)
      .attr("aria-label", "Inspect planner updates")
      .attr("aria-valuemin", 1)
      .attr("aria-valuemax", data.metadata.maxUpdates)
      .attr("aria-valuenow", 1);
    const inspect = (index: number, px = w / 2, py = h / 4) => {
      pointIndex = Math.max(
        0,
        Math.min(data.metadata.sampleUpdates.length - 1, index),
      );
      const update = data.metadata.sampleUpdates[pointIndex];
      inspection
        .attr("x1", x(update))
        .attr("x2", x(update))
        .style("display", null);
      heading.text(`Update ${update}`);
      environment.series.forEach((series, i) =>
        tooltipRows[i].text(formatValue(value(series.points[pointIndex]))),
      );
      overlay
        .attr("aria-valuenow", update)
        .attr(
          "aria-valuetext",
          `Update ${update}. ${environment.series.map((series) => `${series.label}: ${formatValue(value(series.points[pointIndex]))}`).join(". ")}`,
        );
      positionTooltip(
        tooltipElement,
        width,
        height,
        margin.left + px,
        margin.top + py,
      );
    };
    const hide = () => {
      inspection.style("display", "none");
      tooltipElement.style.display = "none";
    };
    overlay
      .on("pointermove", (event: PointerEvent) => {
        const [px, py] = d3.pointer(event, root.node());
        inspect(
          d3.leastIndex(data.metadata.sampleUpdates, (update) =>
            Math.abs(update - x.invert(px)),
          ) ?? 0,
          px,
          py,
        );
      })
      .on("pointerleave", hide)
      .on("focus", () => inspect(pointIndex))
      .on("blur", hide)
      .on("keydown", (event: KeyboardEvent) => {
        let next = pointIndex;
        if (event.key === "ArrowRight") next++;
        else if (event.key === "ArrowLeft") next--;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End")
          next = data.metadata.sampleUpdates.length - 1;
        else return;
        event.preventDefault();
        inspect(next);
      });
    curveLabels(root, environment.series, {
      x,
      y,
      width: w,
      height: h,
      labelWidth: margin.right - 19,
      floor: logY ? LOG_FLOOR : null,
      value,
      color: curveColor,
      background,
      selected,
      onSelect: setSelected,
    });
    if (focusedMethod)
      svg
        .select<SVGTextElement>(
          `.curve-end-label[data-method="${focusedMethod}"]`,
        )
        .node()
        ?.focus({ preventScroll: true });
  }, [
    chartId,
    environment,
    fontScale,
    logX,
    logY,
    metric,
    revision,
    selected,
    width,
  ]);

  return (
    <ChartFrame fontScale={fontScale}>
      <div className="chart-toolbar" aria-label="Chart controls">
        <ChartSelect
          id={`${chartId}-problem`}
          label="Problem"
          value={environmentId}
          options={ENVIRONMENT_OPTIONS}
          onChange={setEnvironmentId}
        />
        <ChartSelect
          id={`${chartId}-metric`}
          label="Y-axis"
          value={metric}
          options={METRIC_OPTIONS}
          onChange={(value) => setMetric(value as Metric)}
        />
        <div className="chart-scale-control">
          <span>Axis scales</span>
          <div className="chart-scale-buttons">
            <button
              type="button"
              aria-pressed={logX}
              aria-label={`Use ${logX ? "linear" : "logarithmic"} x-axis`}
              onClick={() => setLogX((current) => !current)}
            >
              <span>x</span> {logX ? "log" : "linear"}
            </button>
            <button
              type="button"
              aria-pressed={logY}
              aria-label={`Use ${logY ? "linear" : "logarithmic"} y-axis`}
              onClick={() => setLogY((current) => !current)}
            >
              <span>y</span> {logY ? "log" : "linear"}
            </button>
          </div>
        </div>
      </div>
      <div className="chart-plot" ref={plotRef}>
        <svg ref={svgRef} role="group" />
        <div className="chart-tooltip" ref={tooltipRef} role="tooltip" />
      </div>
    </ChartFrame>
  );
}
