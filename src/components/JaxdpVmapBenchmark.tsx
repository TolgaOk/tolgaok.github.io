import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import * as d3 from "d3";

import data from "@/assets/jaxdp/million-update-benchmark.json";
import ChartSelect from "./charts/ChartSelect";
import useChartLayout from "./charts/useChartLayout";
import {
  AXIS_GAP,
  axesFrame,
  bluesPalette,
  colorKey,
  figure,
  fitAxisTicks,
  fitAxisTitle,
  positionTooltip,
  text,
  wrapLabel,
} from "./charts/scientific";
import "./JaxdpPlanningChart.css";

const ENVIRONMENT_OPTIONS = data.environments.map((environment) => ({
  value: environment.id,
  label: environment.label,
}));
const SPEED_BOUNDS = d3.extent(
  data.environments.flatMap((environment) =>
    environment.timings.map(
      (row) => data.metadata.totalUpdates / row.medianSeconds,
    ),
  ),
) as [number, number];

export default function JaxdpVmapBenchmark({
  fontScale = 1,
}: {
  fontScale?: number;
}) {
  const [environmentId, setEnvironmentId] = useState("garnet-medium");
  const plotRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { width, revision } = useChartLayout(plotRef);
  const chartId = `jaxdp-benchmark-${useId().replaceAll(":", "")}`;
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
    tooltipElement.style.display = "none";
    const narrow = width < 610,
      top = 64,
      rowHeight = narrow ? 56 : 58;
    const axisY = top + environment.timings.length * rowHeight,
      height = axisY + 64;
    const left = (narrow ? 124 : 181) + AXIS_GAP,
      right = narrow ? 70 : 94;
    const w = Math.max(1, width - left - right);
    const x = d3
      .scaleLinear()
      .domain([0, d3.max(environment.timings, (row) => row.p75Seconds)! * 1.08])
      .nice()
      .range([0, w]);
    const background = getComputedStyle(svgElement)
      .getPropertyValue("--chart-canvas")
      .trim();
    const palette = bluesPalette(background);
    const speedScale = d3
      .scaleLog()
      .domain(SPEED_BOUNDS)
      .range([0, 1])
      .clamp(true);
    const ticks = x.ticks(narrow ? 3 : 5),
      minorTicks = x.ticks(narrow ? 10 : 20).filter((n) => !ticks.includes(n));
    const svg = figure(
      svgElement,
      width,
      height,
      chartId,
      `Time for one million planner updates on ${environment.label}`,
      `Bar lengths show median execution time. Capped intervals show the 25th and 75th percentiles of ${data.metadata.repetitions} runs. Bar colors encode updates per second on a fixed logarithmic Blues scale across all environments. Apple M5 CPU, JAX 64-bit mode. Compilation excluded; initialization included. The time axis starts at zero. Focus a bar to inspect its timing and speed.`,
    );
    const root = svg.append("g").attr("transform", `translate(${left},0)`);
    colorKey(svg, {
      id: `${chartId}-key`,
      width,
      left,
      plotWidth: w,
      narrow,
      low: "Slower",
      high: "Faster",
      title: "Speed",
      color: palette,
      description: `Blues encodes speed on a fixed logarithmic scale across environments, from ${d3.format(".3~g")(SPEED_BOUNDS[0] / 1e6)} to ${d3.format(".3~g")(SPEED_BOUNDS[1] / 1e6)} million updates per second. Darker blue indicates faster updates.`,
    });
    axesFrame(root, w, top - 5, axisY - AXIS_GAP);
    root
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${axisY - AXIS_GAP})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(ticks.filter((n) => n > 0 && n < x.domain()[1]))
          .tickSize(-(axisY - AXIS_GAP - top + 5))
          .tickFormat(() => ""),
      );
    environment.timings.forEach((row, index) => {
      const cy = top + index * rowHeight + 17;
      const name = wrapLabel(
        text(root, -AXIS_GAP - 14, 0, "", "benchmark-name", "end"),
        row.label,
        left - AXIS_GAP - 16,
      );
      const nameBox = name.node()!.getBBox();
      name.attr("y", cy - nameBox.y - nameBox.height / 2);
      root
        .append("rect")
        .attr("class", "timing-bar")
        .attr("data-method", row.algorithm)
        .attr("data-median", row.medianSeconds)
        .attr("data-speed", data.metadata.totalUpdates / row.medianSeconds)
        .attr("x", 0)
        .attr("y", cy - 11)
        .attr("width", x(row.medianSeconds))
        .attr("height", 22)
        .attr(
          "fill",
          palette(speedScale(data.metadata.totalUpdates / row.medianSeconds)),
        );
      const interval = `M${x(row.p25Seconds)},${cy}H${x(row.p75Seconds)}M${x(row.p25Seconds)},${cy - 5}V${cy + 5}M${x(row.p75Seconds)},${cy - 5}V${cy + 5}`;
      root.append("path").attr("class", "interval-halo").attr("d", interval);
      root
        .append("path")
        .attr("class", "timing-interval")
        .attr("data-method", row.algorithm)
        .attr("d", interval);
      text(
        root,
        w + right - 1,
        cy + 6,
        d3.format(".3g")(row.medianSeconds),
        "benchmark-time",
        "end",
      );
    });
    root
      .append("g")
      .attr("class", "axis scientific-x-axis")
      .attr("transform", `translate(0,${axisY})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(ticks)
          .tickSize(6)
          .tickPadding(6)
          .tickFormat(d3.format("~g")),
      )
      .call(fitAxisTicks);
    root
      .append("g")
      .attr("class", "minor-axis")
      .attr("transform", `translate(0,${axisY})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(minorTicks)
          .tickSize(3)
          .tickFormat(() => ""),
      );
    fitAxisTitle(
      text(
        root,
        w / 2,
        axisY + 52,
        "Time / 10⁶ updates (s)",
        "axis-label",
        "middle",
      ),
      width,
      left,
    );

    const tooltip = d3.select(tooltipElement);
    tooltip.selectAll("*").remove();
    const heading = tooltip.append("p");
    const values = ["Median", "IQR", "Speed"].map((label) => {
      const row = tooltip.append("div");
      row.append("span").text(label);
      return row.append("strong");
    });
    const speed = (seconds: number) =>
      `${d3.format(".3~g")(data.metadata.totalUpdates / seconds / 1e6)} M updates/s`;
    const inspect = (
      row: (typeof environment.timings)[number],
      px: number,
      py: number,
    ) => {
      heading.text(row.label);
      values[0].text(`${d3.format(".5~g")(row.medianSeconds)} s`);
      values[1].text(
        `${d3.format(".5~g")(row.p25Seconds)}–${d3.format(".5~g")(row.p75Seconds)} s`,
      );
      values[2].text(speed(row.medianSeconds));
      positionTooltip(tooltipElement, width, height, left + px, py);
    };
    const hide = () => {
      tooltipElement.style.display = "none";
    };
    root
      .append("g")
      .selectAll("rect")
      .data(environment.timings)
      .join("rect")
      .attr("class", "benchmark-hit")
      .attr("role", "img")
      .attr("tabindex", 0)
      .attr("data-method", (row) => row.algorithm)
      .attr(
        "aria-label",
        (row) =>
          `${row.label}. Median ${d3.format(".5~g")(row.medianSeconds)} seconds. Interquartile range ${d3.format(".5~g")(row.p25Seconds)} to ${d3.format(".5~g")(row.p75Seconds)} seconds. Speed ${speed(row.medianSeconds)}.`,
      )
      .attr("x", 0)
      .attr("y", (_, i) => top + i * rowHeight + 18 - rowHeight / 2)
      .attr("width", w)
      .attr("height", rowHeight - 2)
      .on("pointermove", (event: PointerEvent, row) => {
        const [px, py] = d3.pointer(event, root.node());
        inspect(row, px, py);
      })
      .on("pointerleave", hide)
      .on("focus", (_, row) =>
        inspect(
          row,
          w / 2,
          top + environment.timings.indexOf(row) * rowHeight + 17,
        ),
      )
      .on("blur", hide);
  }, [chartId, environment, fontScale, revision, width]);

  return (
    <figure
      className="jaxdp-chart jaxdp-benchmark not-prose"
      style={{ "--figure-font-scale": fontScale } as CSSProperties}
    >
      <div
        className="chart-toolbar benchmark-toolbar"
        aria-label="Benchmark controls"
      >
        <ChartSelect
          id={`${chartId}-problem`}
          label="Problem"
          value={environmentId}
          options={ENVIRONMENT_OPTIONS}
          onChange={setEnvironmentId}
        />
      </div>
      <div className="chart-plot" ref={plotRef}>
        <svg ref={svgRef} role="group" />
        <div className="chart-tooltip" ref={tooltipRef} role="tooltip" />
      </div>
    </figure>
  );
}
