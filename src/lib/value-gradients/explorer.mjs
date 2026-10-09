// Site adapter for /Users/tok/research/vectorfield-rl/visualization/app.mjs.
// Numerical routines are copied unchanged; DOM queries and lifetimes are scoped.
import * as d3 from "d3";
import {
  figure,
  contrastColor,
  bluesPalette,
} from "../../components/charts/scientific";
import { streamlines } from "../../components/charts/streamlines.mjs";
import {
  DEFAULTS,
  FIELDS,
  drift,
  deterministicPath,
  ascentStep,
} from "./simulation.mjs";
import { createExplorerEvaluator } from "./evaluation.mjs";

const METHODS = ["reinforce", "pathwise"];
export const DEFAULT_FIELD = "inertial";
export const DEFAULT_SAMPLE_COUNT = 64;
const EXPLORER_DEFAULTS = {
  ...DEFAULTS,
  field: DEFAULT_FIELD,
  samples: DEFAULT_SAMPLE_COUNT,
};

function initialState(field) {
  return field === "inertial" ? [-0.55, 0.8] : [...FIELDS[field].initial];
}

export function mountExplorer(element, id, onReset = () => {}) {
  const $ = (name) => element.querySelector(`[data-control="${name}"]`);
  const events = new AbortController();
  const listen = (name, type, callback) =>
    $(name).addEventListener(type, callback, { signal: events.signal });
  const cfg = { ...EXPLORER_DEFAULTS };
  let initial = initialState(cfg.field);
  let frame = null,
    current = null,
    paths = [],
    traces = [];
  let pathWorker = null,
    version = 0,
    gradientBusy = false,
    pathBusy = false,
    disposed = false;
  const colors = {};
  const evaluate = createExplorerEvaluator();
  const width = 900,
    height = 630;
  const sx = d3.scaleLinear().range([0, width]);
  const sy = d3.scaleLinear().range([height, 0]);
  const line = d3
    .line()
    .x((point) => sx(point[0]))
    .y((point) => sy(point[1]));
  const svg = figure(
    element.querySelector(".chart-plot > svg"),
    width,
    height,
    id,
    "Initial-state value gradients in a stochastic vector field",
    "Drag the initial state or use arrow keys. Neutral streamlines show the drift. Thin colored curves are process trajectories; thick curves update the initial state. Noise is 0.10 and horizon is 64. Switch methods, field and sample count to compare estimators.",
  );
  const defs = svg.append("defs");
  defs
    .append("clipPath")
    .attr("id", `${id}-clip`)
    .append("rect")
    .attr("width", width)
    .attr("height", height);
  let streamlineField = null,
    fieldCurves = [];
  const fieldLine = d3.line().curve(d3.curveCatmullRom.alpha(0.5));
  const root = svg.append("g");
  const clipped = root.append("g").attr("clip-path", `url(#${id}-clip)`);
  const background = clipped.append("g");
  const fieldLayer = clipped.append("g");
  const pathLayer = clipped.append("g");
  const ascentLayer = clipped
    .append("g")
    .attr("class", "ascent-layer")
    .attr("pointer-events", "none");
  const hit = root
    .append("rect")
    .attr("class", "plot-hit")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "transparent")
    .style("cursor", "crosshair");
  const handle = root
    .append("g")
    .attr("class", "initial-handle")
    .attr("tabindex", 0)
    .attr("role", "button");
  handle.append("circle").attr("r", 11).attr("stroke-width", 2.5);
  handle.append("circle").attr("r", 3);
  handle
    .append("title")
    .text("Drag to move. Arrow keys nudge; Shift moves faster. Home resets.");
  const selectedMethods = () =>
    METHODS.filter((method) => $(`show-${method}`).checked);
  const valid = () =>
    ["step-size", "path-steps"].every((name) => $(name).validity.valid);
  const dashes = { reinforce: "8,4", pathwise: null };

  function status() {
    $("status").textContent = gradientBusy
      ? "Computing gradient estimates"
      : pathBusy
        ? "Computing ascent paths"
        : "Ready";
    svg
      .attr("aria-busy", String(gradientBusy))
      .attr("data-path-state", pathBusy ? "computing" : "ready");
  }
  function error(message) {
    $("error").hidden = !message;
    $("error").textContent = message || "";
  }
  function drawField() {
    const definition = FIELDS[cfg.field];
    sx.domain(definition.domain.x);
    sy.domain(definition.domain.y);
    background.selectAll("*").remove();
    background
      .append("rect")
      .attr("class", "reward-region")
      .attr("data-reward", 0)
      .attr("width", sx(0))
      .attr("height", height)
      .attr("fill", colors.regionZero);
    background
      .append("rect")
      .attr("class", "reward-region")
      .attr("data-reward", 1)
      .attr("x", sx(0))
      .attr("width", width - sx(0))
      .attr("height", height)
      .attr("fill", colors.regionPositive);
    fieldLayer.selectAll("*").remove();
    // Like the drawing template, keep spacing and arrow size in screen pixels.
    const scale =
      (element.querySelector(".chart-plot").clientWidth || width) / width;
    const separation = 32 / scale;
    const key = `${cfg.field}:${separation.toFixed(2)}`;
    if (streamlineField !== key) {
      fieldCurves = streamlines(
        (point) => drift(point, cfg.field),
        sx,
        sy,
        width,
        height,
        separation,
      );
      streamlineField = key;
    }
    fieldLayer
      .selectAll(".stream")
      .data(fieldCurves)
      .join("path")
      .attr("class", "stream")
      .attr("d", fieldLine)
      .attr("fill", "none")
      .attr("stroke", colors.stream)
      .attr("stroke-width", 1.2 / scale)
      .attr("stroke-linecap", "round");
    // Direction chevrons sit inside each integral curve, as in the drawing template.
    const heads = [];
    for (const points of fieldCurves) {
      for (let i = 6; i < points.length - 2; i += 30) {
        const before = points[i - 1],
          after = points[i + 1];
        heads.push({
          point: points[i],
          angle:
            (Math.atan2(after[1] - before[1], after[0] - before[0]) * 180) /
            Math.PI,
        });
      }
    }
    const headSize = 4.5 / scale;
    fieldLayer
      .selectAll(".stream-direction")
      .data(heads)
      .join("path")
      .attr("class", "stream-direction")
      .attr(
        "d",
        `M${-headSize},${-headSize * 0.75}L${headSize},0L${-headSize},${headSize * 0.75}Z`,
      )
      .attr(
        "transform",
        (head) => `translate(${head.point})rotate(${head.angle})`,
      )
      .attr("fill", colors.stream);
    fieldLayer
      .selectAll(".equilibrium")
      .data(definition.equilibria)
      .join("circle")
      .attr("class", "equilibrium")
      .attr("cx", (point) => sx(point[0]))
      .attr("cy", (point) => sy(point[1]))
      .attr("r", 4.5 / scale)
      .attr("fill", (point) =>
        Math.hypot(...point) < 1e-12 ? colors.canvas : colors.ink,
      )
      .attr("stroke", colors.ink)
      .attr("stroke-width", 1.5 / scale);
  }
  function updateHandle() {
    handle
      .attr("transform", `translate(${sx(initial[0])},${sy(initial[1])})`)
      .attr(
        "aria-label",
        `Initial state ${initial.map((value) => value.toFixed(3)).join(", ")}. Drag or use arrow keys to move.`,
      );
  }
  function renderPaths() {
    const opacity = Math.min(0.6, 0.6 * Math.sqrt(32 / paths.length));
    pathLayer
      .selectAll(".trajectory")
      .data(paths)
      .join("path")
      .attr("class", "trajectory")
      .attr("d", (d) => line(d.points))
      .attr("fill", "none")
      .attr("stroke", (d) => (d.reward ? colors.positive : colors.zero))
      .attr("stroke-width", 1.6)
      .attr("opacity", opacity);
    pathLayer
      .selectAll(".particle")
      .data(paths)
      .join("circle")
      .attr("class", "particle")
      .attr("cx", (d) => sx(d.points.at(-1)[0]))
      .attr("cy", (d) => sy(d.points.at(-1)[1]))
      .attr("r", 3)
      .attr("fill", (d) => (d.reward ? colors.positive : colors.zero))
      .attr("opacity", Math.min(1, 2 * opacity));
    pathLayer
      .selectAll(".deterministic")
      .data([deterministicPath(initial, cfg)])
      .join("path")
      .attr("class", "deterministic")
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", colors.ink)
      .attr("stroke-width", 2.5)
      .raise();
  }
  function drawMethodPaths() {
    ascentLayer.selectAll("*").remove();
    for (const trace of traces.filter((trace) =>
      selectedMethods().includes(trace.method),
    )) {
      const group = ascentLayer.append("g").attr("data-method", trace.method);
      const dash = dashes[trace.method];
      group
        .append("path")
        .attr("d", line(trace.points))
        .attr("fill", "none")
        .attr("stroke", colors.canvas)
        .attr("stroke-width", 9)
        .attr("stroke-dasharray", dash)
        .attr("opacity", 0.85);
      group
        .append("path")
        .datum(trace.points)
        .attr("class", "ascent-trace")
        .attr("d", line)
        .attr("fill", "none")
        .attr("stroke", colors[trace.method])
        .attr("stroke-width", 6)
        .attr("stroke-dasharray", dash)
        .attr("data-method", trace.method)
        .attr("data-steps", trace.points.length - 1)
        .attr("data-reason", trace.reason);
    }
  }
  function cancelPaths() {
    version++;
    pathWorker?.postMessage({ cancel: true });
    traces = [];
    drawMethodPaths();
    pathBusy = false;
    status();
  }
  function ensureWorker() {
    if (pathWorker) return pathWorker;
    const worker = new Worker(new URL("./path-worker.mjs", import.meta.url), {
      type: "module",
    });
    pathWorker = worker;
    worker.onmessage = ({ data }) => {
      if (disposed || pathWorker !== worker || data.version !== version) return;
      if (data.error) {
        pathBusy = false;
        status();
        error(data.error);
        return;
      }
      traces = data.traces;
      drawMethodPaths();
      pathBusy = !data.done;
      status();
    };
    worker.onerror = (event) => {
      if (disposed || pathWorker !== worker) return;
      worker.terminate();
      pathWorker = null;
      pathBusy = false;
      status();
      error(event.message || "Ascent worker failed.");
    };
    return worker;
  }
  function startPaths() {
    const methods = selectedMethods();
    if (!methods.length || !valid()) return;
    const steps = $("path-steps").valueAsNumber;
    traces = methods.map((method) => {
      const step = ascentStep(initial, current.estimates[method].mean, cfg);
      return {
        method,
        points: step.reason ? [[...initial]] : [[...initial], step.next],
        reason: step.reason || (steps === 1 ? "limit" : null),
      };
    });
    drawMethodPaths();
    if (traces.every((trace) => trace.reason !== null)) return;
    pathBusy = true;
    status();
    try {
      ensureWorker().postMessage({
        version,
        initial: [...initial],
        cfg: { ...cfg },
        methods,
        steps,
        initialEstimates: current.estimates,
      });
    } catch (err) {
      pathBusy = false;
      status();
      error(err.message);
    }
  }
  function refresh(fieldChanged = false) {
    cancelPaths();
    current = null;
    gradientBusy = true;
    status();
    error(null);
    if (fieldChanged) drawField();
    updateHandle();
    if (frame !== null) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = null;
      if (disposed) return;
      try {
        current = evaluate(initial, cfg, valid() ? selectedMethods() : []);
        svg
          .attr("data-initial-x", initial[0])
          .attr("data-initial-y", initial[1])
          .attr("data-samples", cfg.samples);
        paths = current.paths;
        renderPaths();
        startPaths();
      } catch (err) {
        error(err.message);
      } finally {
        gradientBusy = false;
        status();
      }
    });
  }
  function setInitial(point) {
    const domain = FIELDS[cfg.field].domain;
    initial = point.map((value, i) => {
      const bounds = i === 0 ? domain.x : domain.y;
      return Math.max(bounds[0], Math.min(bounds[1], value));
    });
    refresh();
  }
  hit.on("click", (event) => {
    const [x, y] = d3.pointer(event, root.node());
    setInitial([sx.invert(x), sy.invert(y)]);
  });
  handle.call(
    d3
      .drag()
      .container(root.node())
      .subject(() => ({ x: sx(initial[0]), y: sy(initial[1]) }))
      .on("drag", (event) =>
        setInitial([sx.invert(event.x), sy.invert(event.y)]),
      ),
  );
  handle.on("keydown", (event) => {
    if (event.key === "Home") {
      event.preventDefault();
      setInitial(initialState(cfg.field));
      return;
    }
    const direction = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, 1],
      ArrowDown: [0, -1],
    }[event.key];
    if (!direction) return;
    event.preventDefault();
    const { x, y } = FIELDS[cfg.field].domain,
      divisor = event.shiftKey ? 20 : 200;
    setInitial(
      initial.map(
        (value, i) =>
          value +
          (direction[i] * ((i === 0 ? x : y)[1] - (i === 0 ? x : y)[0])) /
            divisor,
      ),
    );
  });
  function labels() {
    $("step-size-value").value = cfg.rate.toFixed(3);
    $("path-steps-value").value = $("path-steps").value;
  }
  function configure(field, samples) {
    if (field === cfg.field && samples === cfg.samples) return;
    const fieldChanged = field !== cfg.field;
    cfg.field = field;
    cfg.samples = samples;
    if (fieldChanged) initial = initialState(field);
    refresh(fieldChanged);
  }
  for (const method of METHODS)
    listen(`show-${method}`, "change", () => refresh());
  listen("resample", "click", () => {
    cfg.seed = (cfg.seed + 1) >>> 0;
    refresh();
  });
  listen("step-size", "input", (event) => {
    if (event.target.validity.valid) cfg.rate = event.target.valueAsNumber;
    labels();
    refresh();
  });
  listen("path-steps", "input", () => {
    labels();
    refresh();
  });
  listen("reset", "click", () => {
    Object.assign(cfg, EXPLORER_DEFAULTS);
    initial = initialState(cfg.field);
    for (const method of METHODS) $(`show-${method}`).checked = true;
    $("step-size").value = cfg.rate;
    $("path-steps").value = "40";
    labels();
    onReset();
    refresh(true);
  });
  function redraw() {
    const theme = getComputedStyle(element);
    colors.canvas = theme.getPropertyValue("--chart-canvas").trim();
    colors.ink = theme.getPropertyValue("--chart-text").trim();
    colors.stream = theme.getPropertyValue("--chart-subtle").trim();
    const blue = bluesPalette(colors.canvas);
    colors.reinforce = contrastColor("#c43c39", colors.canvas, 4.5);
    colors.pathwise = contrastColor(blue(0.8), colors.canvas, 4.5);
    for (const method of METHODS)
      element.style.setProperty(`--method-${method}`, colors[method]);
    // Outcome colors are separate from the red/blue estimator comparison.
    colors.positive = contrastColor("#3267b0", colors.canvas, 3);
    colors.zero = contrastColor("#b34b4b", colors.canvas, 3);
    colors.regionPositive = d3.interpolateRgb(
      colors.canvas,
      colors.positive,
    )(0.08);
    colors.regionZero = d3.interpolateRgb(colors.canvas, colors.zero)(0.08);
    handle
      .select("circle:first-child")
      .attr("fill", colors.canvas)
      .attr("stroke", colors.ink);
    handle.select("circle:nth-child(2)").attr("fill", colors.ink);
    drawField();
    updateHandle();
    renderPaths();
    drawMethodPaths();
  }
  labels();
  redraw();
  refresh();
  return {
    redraw,
    configure,
    dispose() {
      disposed = true;
      events.abort();
      if (frame !== null) cancelAnimationFrame(frame);
      pathWorker?.terminate();
      svg.selectAll("*").remove();
    },
  };
}
