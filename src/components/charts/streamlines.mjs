import * as d3 from "d3";

// Adapted from research-figures/template/stream.mjs. Trace in pixel space so
// spacing is uniform even when the two state coordinates use different scales.
// These are geometric integral curves, not time-parametrized process rollouts.
export function streamlines(field, x, y, width, height, separation = 38) {
  const step = separation / 6;
  const cols = Math.ceil(width / separation),
    rows = Math.ceil(height / separation);
  const owner = new Int32Array(cols * rows).fill(-1);
  const cell = ([px, py]) =>
    Math.floor(py / separation) * cols + Math.floor(px / separation);
  const kx = width / (x.domain()[1] - x.domain()[0]);
  const ky = height / (y.domain()[1] - y.domain()[0]);
  const direction = ([px, py]) => {
    const velocity = field([x.invert(px), y.invert(py)]);
    const vx = velocity[0] * kx,
      vy = -velocity[1] * ky,
      norm = Math.hypot(vx, vy);
    return Number.isFinite(norm) && norm > 1e-10
      ? [vx / norm, vy / norm]
      : null;
  };
  const trace = (seed, sign) => {
    const points = [],
      visited = new Map();
    let point = seed;
    for (let i = 0; i < 1500; i++) {
      const first = direction(point);
      if (!first) break;
      const midpoint = point.map(
        (value, axis) => value + (sign * first[axis] * step) / 2,
      );
      const second = direction(midpoint);
      if (!second) break;
      const next = point.map(
        (value, axis) => value + sign * second[axis] * step,
      );
      if (next[0] < 0 || next[1] < 0 || next[0] >= width || next[1] >= height)
        break;
      const index = cell(next);
      if (owner[index] !== -1) break;
      // Stop near equilibria and closed orbits instead of retracing the same cells.
      if (visited.has(index) && i - visited.get(index) > 12) break;
      if (!visited.has(index)) visited.set(index, i);
      points.push(next);
      point = next;
    }
    return points;
  };
  const seeds = d3.shuffler(d3.randomLcg(3))(d3.range(cols * rows));
  const lines = [];
  for (const index of seeds) {
    if (owner[index] !== -1) continue;
    const seed = [
      ((index % cols) + 0.5) * separation,
      (Math.floor(index / cols) + 0.5) * separation,
    ];
    if (seed[0] >= width || seed[1] >= height) continue;
    const points = [...trace(seed, -1).reverse(), seed, ...trace(seed, 1)];
    if (points.length < 6) continue;
    for (const point of points) owner[cell(point)] = lines.length;
    lines.push(points);
  }
  return lines;
}
