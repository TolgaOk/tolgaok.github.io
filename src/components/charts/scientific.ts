import * as d3 from "d3";

type Group = d3.Selection<SVGGElement, unknown, null, undefined>;
type Svg = d3.Selection<SVGSVGElement, unknown, null, undefined>;
type Text = d3.Selection<SVGTextElement, unknown, null, undefined>;
export type ChartScale = d3.ScaleContinuousNumeric<number, number>;

export interface ChartPoint {
  update: number;
  residual: number;
  error: number;
}

export interface CurveSeries {
  algorithm: string;
  label: string;
  points: ChartPoint[];
}

export const LOG_FLOOR = 1e-16;
export const AXIS_GAP = 12;
export const CURVE_DASHES: Record<string, string | null> = {
  "value-iteration": "8 3",
  "anchored-vi": "4 3",
  "anderson-vi": "1.5 3",
  "safe-anderson-vi": null,
};

export function formatValue(value: number) {
  return value === 0
    ? "0"
    : value < 0.001
      ? d3.format(".2e")(value)
      : d3.format(".3~g")(value);
}

export function power(value: d3.NumberValue) {
  const digits: Record<string, string> = {
    "-": "⁻",
    "0": "⁰",
    "1": "¹",
    "2": "²",
    "3": "³",
    "4": "⁴",
    "5": "⁵",
    "6": "⁶",
    "7": "⁷",
    "8": "⁸",
    "9": "⁹",
  };
  return (
    "10" +
    String(Math.round(Math.log10(+value)))
      .split("")
      .map((digit) => digits[digit])
      .join("")
  );
}

export function contrastColor(
  color: string,
  background: string,
  minimum: number,
) {
  const luminance = (input: string) => {
    const rgb = d3.rgb(input);
    const channels = [rgb.r, rgb.g, rgb.b]
      .map((value) => value / 255)
      .map((value) =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
      );
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const bg = luminance(background);
  const blend = d3.interpolateRgb(color, bg < 0.5 ? "#ffffff" : "#000000");
  for (let step = 0; step <= 40; step++) {
    const candidate = blend(step / 40),
      fg = luminance(candidate);
    if ((Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05) >= minimum)
      return candidate;
  }
  return blend(1);
}

export function bluesPalette(background: string) {
  return (value: number) =>
    contrastColor(
      d3.interpolateBlues(0.4 + 0.5 * Math.max(0, Math.min(1, value))),
      background,
      3,
    );
}

export function figure(
  svgElement: SVGSVGElement,
  width: number,
  height: number,
  id: string,
  title: string,
  description: string,
) {
  const svg = d3
    .select(svgElement)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("aria-labelledby", `${id}-title ${id}-description`);
  svg.selectAll("*").remove();
  svg.append("title").attr("id", `${id}-title`).text(title);
  svg.append("desc").attr("id", `${id}-description`).text(description);
  return svg;
}

export function text(
  group: Group | Svg,
  x: number,
  y: number,
  value: string,
  className: string,
  anchor = "start",
) {
  return group
    .append("text")
    .attr("x", x)
    .attr("y", y)
    .attr("class", className)
    .attr("text-anchor", anchor)
    .text(value);
}

export function axisTitle(
  group: Group | Svg,
  x: number,
  y: number,
  label: string,
  math = "",
  anchor = "middle",
) {
  const node = text(group, x, y, label, "axis-label", anchor);
  if (math) node.append("tspan").attr("class", "math-label").text(math);
  return node;
}

export function colorKey(
  svg: Svg,
  options: {
    id: string;
    width: number;
    left: number;
    plotWidth: number;
    narrow: boolean;
    top?: number;
    low: string;
    high: string;
    title: string;
    description: string;
    color: (value: number) => string;
  },
) {
  const {
    id,
    width,
    left,
    plotWidth,
    narrow,
    top = 0,
    low,
    high,
    title,
    description,
    color,
  } = options;
  const gradient = svg
    .append("defs")
    .append("linearGradient")
    .attr("id", `${id}-gradient`);
  gradient
    .selectAll("stop")
    .data(d3.range(21).map((index) => index / 20))
    .join("stop")
    .attr("offset", (value) => `${value * 100}%`)
    .attr("stop-color", color);
  const key = svg
    .append("g")
    .attr("class", "color-key")
    .attr("role", "img")
    .attr("aria-label", description);
  const lowText = text(
    key,
    -10,
    12,
    low,
    "color-key-label color-key-low",
    "end",
  ).attr("dominant-baseline", "middle");
  const highText = text(
    key,
    0,
    12,
    high,
    "color-key-label color-key-high",
  ).attr("dominant-baseline", "middle");
  const lowWidth = lowText.node()!.getBBox().width,
    highWidth = highText.node()!.getBBox().width;
  const keyWidth = Math.min(
    narrow ? 220 : 260,
    width - 44 - lowWidth - highWidth,
  );
  const keyX = Math.max(
    22 + lowWidth,
    Math.min(
      width - 22 - highWidth - keyWidth,
      left + plotWidth / 2 - keyWidth / 2,
    ),
  );
  key.attr("transform", `translate(${keyX},${top})`);
  highText.attr("x", keyWidth + 10);
  key
    .append("rect")
    .attr("y", 6)
    .attr("width", keyWidth)
    .attr("height", 12)
    .attr("fill", `url(#${id}-gradient)`);
  text(
    key,
    keyWidth / 2,
    38,
    title,
    "color-key-label color-key-title",
    "middle",
  );
}

export function axesFrame(
  group: Group,
  width: number,
  top: number,
  bottom: number,
) {
  group
    .append("path")
    .attr("class", "scientific-frame scientific-y-spine")
    .attr("d", `M${-AXIS_GAP},${top}V${bottom}`);
  group
    .append("path")
    .attr("class", "scientific-frame scientific-x-spine")
    .attr("d", `M0,${bottom + AXIS_GAP}H${width}`);
}

export function wrapLabel(node: Text, label: string, width: number) {
  const x = node.attr("x"),
    lineHeight = parseFloat(getComputedStyle(node.node()!).fontSize) * 1.2;
  let line: string[] = [],
    span = node.append("tspan").attr("x", x).attr("dy", 0);
  for (const word of label.split(" ")) {
    line.push(word);
    span.text(line.join(" "));
    if (line.length > 1 && span.node()!.getComputedTextLength() > width) {
      span.text(line.slice(0, -1).join(" "));
      line = [word];
      span = node
        .append("tspan")
        .attr("x", x)
        .attr("dy", lineHeight)
        .text(word);
    }
  }
  return node;
}

export function fitAxisTicks(axis: Group) {
  const labels = axis.selectAll<SVGTextElement, unknown>(".tick text").nodes();
  if (labels.length < 3) return;
  const kept = [labels[0], labels.at(-1)!].map((node) =>
    node.getBoundingClientRect(),
  );
  for (const label of labels.slice(1, -1)) {
    const box = label.getBoundingClientRect();
    if (
      kept.some(
        (other) => box.left < other.right + 2 && box.right > other.left - 2,
      )
    )
      label.style.display = "none";
    else kept.push(box);
  }
}

export function fitAxisTitle(label: Text, width: number, left: number) {
  const box = label.node()!.getBBox();
  const shift = Math.max(
    2 - left - box.x,
    Math.min(0, width - left - 2 - box.x - box.width),
  );
  label.attr("x", +label.attr("x") + shift);
}

export function curveLabels(
  group: Group,
  series: CurveSeries[],
  options: {
    x: ChartScale;
    y: ChartScale;
    width: number;
    height: number;
    labelWidth: number;
    floor: number | null;
    value: (point: ChartPoint) => number;
    color: (series: CurveSeries) => string;
    background: string;
    selected: string;
    onSelect: (id: string) => void;
  },
) {
  const {
    x,
    y,
    width,
    height,
    labelWidth,
    floor,
    value,
    color,
    background,
    selected,
    onSelect,
  } = options;
  const labels = series
    .map((item) => {
      const last = item.points.at(-1)!;
      const endpoint =
        floor !== null && value(last) <= floor
          ? item.points.findLast(
              (point, index, points) =>
                value(point) <= floor &&
                (index === 0 || value(points[index - 1]) > floor),
            )!
          : last;
      const px = x(endpoint.update),
        py = y(
          floor === null ? value(endpoint) : Math.max(floor, value(endpoint)),
        );
      const labelX = width + 18;
      const node = text(
        group,
        labelX,
        0,
        "",
        `curve-end-label${item.algorithm === selected ? " highlight" : ""}`,
      )
        .attr("data-method", item.algorithm)
        .attr("role", "button")
        .attr("tabindex", 0)
        .attr("aria-label", `Emphasize ${item.label} label`)
        .attr("aria-pressed", String(item.algorithm === selected))
        .style("fill", contrastColor(color(item), background, 4.5))
        .on("click", () => onSelect(item.algorithm))
        .on("keydown", (event: KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(item.algorithm);
          }
        });
      wrapLabel(node, item.label, labelWidth);
      const box = node.node()!.getBBox();
      return {
        item,
        node,
        px,
        py,
        update: endpoint.update,
        x: labelX,
        height: box.height,
        baseline: -box.y,
        top: Math.max(
          2,
          Math.min(height - box.height - 4, py - box.height / 2),
        ),
      };
    })
    .sort((a, b) => a.py - b.py || a.px - b.px);
  for (let i = 1; i < labels.length; i++)
    labels[i].top = Math.max(
      labels[i].top,
      labels[i - 1].top + labels[i - 1].height + 9,
    );
  for (let i = labels.length - 1; i >= 0; i--) {
    labels[i].top = Math.min(labels[i].top, height - labels[i].height - 4);
    if (i < labels.length - 1)
      labels[i].top = Math.min(
        labels[i].top,
        labels[i + 1].top - labels[i].height - 9,
      );
  }
  for (const label of labels) {
    label.node.attr("y", label.top + label.baseline);
    group
      .insert("path", ".curve-end-label")
      .attr(
        "class",
        `curve-label-connector${label.item.algorithm === selected ? " highlight" : ""}`,
      )
      .attr("data-method", label.item.algorithm)
      .attr("data-end-update", label.update)
      .style("stroke", color(label.item))
      .attr(
        "d",
        `M${label.px + 5},${label.py}L${label.x - 7},${label.top + label.height / 2}H${label.x - 3}`,
      );
    label.node.raise();
  }
}

export function positionTooltip(
  tooltip: HTMLDivElement,
  width: number,
  height: number,
  x: number,
  y: number,
) {
  tooltip.style.display = "block";
  tooltip.style.left = `${Math.max(0, Math.min(width - tooltip.offsetWidth, x + 14))}px`;
  tooltip.style.top = `${Math.max(0, Math.min(height - tooltip.offsetHeight, y + 14))}px`;
}
