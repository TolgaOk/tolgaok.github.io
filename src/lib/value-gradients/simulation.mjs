/** Exact discrete Gaussian dynamics and Monte Carlo estimators, without DOM dependencies. */

export const DEFAULTS = Object.freeze({ field: 'coupled', dt: 0.02, sigma: 0.1, horizon: 64, samples: 256, seed: 37, rate: 0.02, cap: 0.1 });
export const FIELDS = Object.freeze({
  coupled: { label: 'Coupled double well', domain: { x: [-1.5, 1.5], y: [-1.2, 1.2] }, initial: [-0.26, 0.8], equilibria: [[-1, 0], [0, 0], [1, 0]] },
  three: { label: 'Three competing wells', domain: { x: [-1.8, 1.8], y: [-1.44, 1.44] }, initial: [0.02, 0.06], equilibria: Array.from({ length: 3 }, (_, i) => { const r = (0.8 + Math.sqrt(4.64)) / 2, angle = i * 2 * Math.PI / 3; return [r * Math.cos(angle), r * Math.sin(angle)]; }) },
  inertial: { label: 'Damped inertial double well', domain: { x: [-2, 2], y: [-1.6, 1.6] }, initial: [-0.28, 0.8], equilibria: [[-1, 0], [0, 0], [1, 0]] },
});
export const REFERENCE_SAMPLES = 16384;
export const METHODS = Object.freeze(['reinforce', 'hybrid', 'pathwise', 'reference']);

export function validateConfig(cfg) {
  if (!Object.hasOwn(FIELDS, cfg.field)) throw new Error('Unknown drift field');
  for (const key of ['dt', 'sigma', 'rate', 'cap']) {
    if (!Number.isFinite(cfg[key]) || cfg[key] <= 0) throw new Error(`${key} must be positive and finite`);
  }
  if (cfg.dt > 0.02 || cfg.sigma > 0.35) throw new Error('Use dt ≤ 0.02 and sigma ≤ 0.35');
  for (const [key, min, max] of [['horizon', 1, 256], ['samples', 2, 8192], ['seed', 0, 0xffffffff]]) {
    if (!Number.isInteger(cfg[key]) || cfg[key] < min || cfg[key] > max) throw new Error(`Invalid ${key}`);
  }
}

/** Return drift and its row-major Jacobian together to keep all estimators consistent. */
function differential(x, y, field = 'coupled') {
  if (field === 'three') {
    const radial = 1 - x * x - y * y;
    return [radial * x + 0.8 * (x * x - y * y), radial * y - 1.6 * x * y,
      1 - 3 * x * x - y * y + 1.6 * x, -2 * x * y - 1.6 * y,
      -2 * x * y - 1.6 * y, 1 - x * x - 3 * y * y - 1.6 * x];
  }
  if (field === 'inertial') return [y, x - x * x * x - 0.4 * y, 0, 1, 1 - 3 * x * x, -0.4];
  if (field === 'coupled') return [x - x * x * x + 0.8 * y, -y, 1 - 3 * x * x, 0.8, 0, -1];
  throw new Error('Unknown drift field');
}

export function drift([x, y], field = 'coupled') { return differential(x, y, field).slice(0, 2); }
export function transitionMean([x, y], dt, field = 'coupled') {
  const b = differential(x, y, field);
  return [x + dt * b[0], y + dt * b[1]];
}
export function transitionJacobian([x, y], dt, field = 'coupled') {
  const b = differential(x, y, field);
  return [[1 + dt * b[2], dt * b[3]], [dt * b[4], 1 + dt * b[5]]];
}
export function normalPdf(z) { return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI); }

/** Convergent Gaussian integral series; absolute accuracy, not relative tail accuracy.
 * The integral from zero is phi(z) times (z + z³/3 + z⁵/(3·5) + ...).
 * Beyond nine standard deviations the omitted tail is below 1.2e-19.
 */
export function normalCdf(z) {
  if (Number.isNaN(z)) return NaN;
  if (z <= -9) return 0;
  if (z >= 9) return 1;
  let term = z, sum = z, previous;
  for (let denominator = 3; denominator < 1000; denominator += 2) {
    term *= z * z / denominator;
    previous = sum;
    sum += term;
    if (sum === previous) break;
  }
  return Math.max(0, Math.min(1, 0.5 + normalPdf(z) * sum));
}

/** Stable phi(z) / Phi(z), using the Gaussian tail continued fraction below -4. */
export function inverseMillsRatio(z) {
  if (z < -4) {
    const t = -z;
    let tail = 0;
    for (let n = 64; n >= 1; n--) tail = n / (t + tail);
    return t + tail;
  }
  return normalPdf(z) / normalCdf(z);
}

/** Log CDF without clipping rare-event probabilities to a positive floor. */
export function normalLogCdf(z) {
  if (z < -4) return -0.5 * z * z - 0.5 * Math.log(2 * Math.PI) - Math.log(inverseMillsRatio(z));
  if (z > 0) return Math.log1p(-Math.exp(normalLogCdf(-z)));
  return Math.log(normalCdf(z));
}

/** Bernoulli log-likelihood derivative with respect to standardized head mean z. */
export function rewardHeadScore(z, reward) {
  if (reward === 1) return inverseMillsRatio(z);
  if (reward === 0) return -inverseMillsRatio(-z);
  throw new Error('The reward head is Bernoulli');
}

/** Seeded Mulberry32 uniform stream and Box–Muller independent Gaussian pairs. */
export function gaussianGenerator(seed) {
  let state = seed >>> 0;
  let spare = null;
  function uniform() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return () => {
    if (spare !== null) { const result = spare; spare = null; return result; }
    const radius = Math.sqrt(-2 * Math.log(1 - uniform()));
    const angle = 2 * Math.PI * uniform();
    spare = radius * Math.sin(angle);
    return radius * Math.cos(angle);
  };
}

export function noisePool(count, horizon, seed) {
  const random = gaussianGenerator(seed);
  return Float64Array.from({ length: count * horizon * 2 }, random);
}

/** Track the exact tangent Jacobian and use the same sampled terminal event for RF and hybrid.
 * Conditional on the prefix, R ~ Bernoulli(Phi(headZ)). The hybrid transports R times
 * its log-likelihood score; pathwise instead integrates R out. The tangent at the
 * last step includes the derivative of the final conditional mean, not of R.
 */
export function sample(initial, cfg, noise, keepPath = false) {
  const { dt, sigma, horizon } = cfg;
  const s = sigma * Math.sqrt(dt);
  let [x, y] = initial;
  let j00 = 1, j01 = 0, j10 = 0, j11 = 1;
  const firstA = transitionJacobian(initial, dt, cfg.field);
  const path = keepPath ? [[x, y]] : null;
  let probability, pathwise, headZ;
  for (let k = 0; k < horizon; k++) {
    const b = differential(x, y, cfg.field);
    const a00 = 1 + dt * b[2], a01 = dt * b[3], a10 = dt * b[4], a11 = 1 + dt * b[5];
    const next00 = a00 * j00 + a01 * j10, next01 = a00 * j01 + a01 * j11;
    j10 = a10 * j00 + a11 * j10;
    j11 = a10 * j01 + a11 * j11;
    j00 = next00; j01 = next01;
    const mx = x + dt * b[0], my = y + dt * b[1];
    if (k === horizon - 1) {
      headZ = mx / s;
      probability = normalCdf(headZ);
      const incoming = normalPdf(headZ) / s;
      pathwise = [incoming * j00, incoming * j01];
    }
    x = mx + s * noise[2 * k];
    y = my + s * noise[2 * k + 1];
    if (path) path.push([x, y]);
  }
  const reward = Number(x > 0);
  const reinforce = [0, 1].map(j => reward * (firstA[0][j] * noise[0] + firstA[1][j] * noise[1]) / s);
  const incomingScore = reward === 1 ? rewardHeadScore(headZ, reward) / s : 0;
  const hybrid = reward === 1 ? [incomingScore * j00, incomingScore * j01] : [0, 0];
  if (![x, y, probability, ...pathwise, ...reinforce, ...hybrid].every(Number.isFinite)) throw new Error('Nonfinite trajectory or derivative. Reduce the horizon or noise.');
  return { reward, probability, pathwise, reinforce, hybrid, path };
}

/** Probability sample with the last transition marginalized and no tangent computation. */
export function probabilitySample(initial, cfg, noise) {
  let [x, y] = initial;
  const s = cfg.sigma * Math.sqrt(cfg.dt);
  for (let k = 0; k < cfg.horizon; k++) {
    const b = differential(x, y, cfg.field);
    const mx = x + cfg.dt * b[0], my = y + cfg.dt * b[1];
    if (k === cfg.horizon - 1) {
      if (!Number.isFinite(mx)) throw new Error('Nonfinite transition mean');
      return normalCdf(mx / s);
    }
    x = mx + s * noise[2 * k];
    y = my + s * noise[2 * k + 1];
  }
}

/** Welford moments keep componentwise standard errors well behaved near saturation. */
export function moments(dimensions) {
  const mean = Array(dimensions).fill(0), m2 = Array(dimensions).fill(0);
  let count = 0;
  return {
    add(values) {
      count++;
      for (let i = 0; i < dimensions; i++) {
        const delta = values[i] - mean[i];
        mean[i] += delta / count;
        m2[i] += delta * (values[i] - mean[i]);
      }
    },
    result() {
      return { count, mean: [...mean], se: m2.map(value => count > 1 ? Math.sqrt(Math.max(0, value) / (count - 1) / count) : null) };
    },
  };
}

export function clippedUpdate(gradient, cfg) {
  const update = gradient.map(value => cfg.rate * value);
  const factor = Math.min(1, cfg.cap / Math.max(Math.hypot(...update), 1e-30));
  return update.map(value => value * factor);
}

/** One gradient-ascent step in initial-state space, independent of arrow magnification. */
export function ascentStep(initial, gradient, cfg) {
  validateConfig(cfg);
  if (initial.length !== 2 || gradient.length !== 2 || ![...initial, ...gradient].every(Number.isFinite)) throw new Error('Initial state and gradient must be finite pairs');
  const update = clippedUpdate(gradient, cfg);
  if (Math.hypot(...update) < 1e-10) return { next: [...initial], update: [0, 0], reason: 'zero' };
  const next = initial.map((value, i) => value + update[i]);
  const { x, y } = FIELDS[cfg.field].domain;
  if (next[0] < x[0] || next[0] > x[1] || next[1] < y[0] || next[1] > y[1]) return { next: [...initial], update: [0, 0], reason: 'boundary' };
  return { next, update, reason: null };
}

/** Cache noise, not gradients, and evaluate all displayed arrows at the current point.
 * The full selected estimator budget and independent reference budget are retained.
 * No outcome evaluation is needed to redraw arrows during a drag.
 */
export function createGradientEvaluator(referenceCount = REFERENCE_SAMPLES) {
  if (!Number.isInteger(referenceCount) || referenceCount < 2) throw new Error('At least two reference samples are required');
  let sampleKey = '', referenceKey = '', samples = null, reference = null;
  return (initial, cfg, methods = METHODS, keepPaths = true) => {
    validateConfig(cfg);
    if (initial.length !== 2 || !initial.every(Number.isFinite)) throw new Error('Initial state must be a finite pair');
    if (methods.some(method => !METHODS.includes(method))) throw new Error('Unknown gradient method');
    const selected = new Set(methods);
    const paired = selected.has('reinforce') || selected.has('hybrid') || selected.has('pathwise');
    const sampleCount = paired ? cfg.samples : keepPaths ? Math.min(32, cfg.samples) : 0;
    const nextReferenceKey = `${cfg.seed}:${cfg.horizon}`;
    const nextSampleKey = `${nextReferenceKey}:${cfg.samples}`;
    if (sampleCount && nextSampleKey !== sampleKey) {
      samples = noisePool(cfg.samples, cfg.horizon, cfg.seed);
      sampleKey = nextSampleKey;
    }
    if (selected.has('reference') && nextReferenceKey !== referenceKey) {
      reference = noisePool(referenceCount, cfg.horizon, (cfg.seed ^ 0xa511e9b3) >>> 0);
      referenceKey = nextReferenceKey;
    }
    const rf = moments(2), hy = moments(2), pw = moments(2), ref = moments(2), paths = [];
    const stride = 2 * cfg.horizon;
    for (let i = 0; i < sampleCount; i++) {
      const result = sample(initial, cfg, samples.subarray(i * stride, (i + 1) * stride), keepPaths && i < 32);
      rf.add(result.reinforce); hy.add(result.hybrid); pw.add(result.pathwise);
      if (result.path) paths.push({ points: result.path, reward: result.reward });
    }
    if (selected.has('reference')) for (let i = 0; i < referenceCount; i++) {
      ref.add(sample(initial, cfg, reference.subarray(i * stride, (i + 1) * stride)).pathwise);
    }
    const all = { reinforce: rf.result(), hybrid: hy.result(), pathwise: pw.result(), reference: ref.result() };
    const estimates = Object.fromEntries(METHODS.filter(method => selected.has(method)).map(method => [method, all[method]]));
    for (const estimate of Object.values(estimates)) estimate.update = clippedUpdate(estimate.mean, cfg);
    return { initial: [...initial], cfg: { ...cfg }, estimates, paths, referenceCount };
  };
}

/** Build independent ascent curves from one common start, yielding cancellable progress. */
export function* ascentPaths(initial, cfg, methods, steps, evaluate = createGradientEvaluator(), initialEstimates = null) {
  validateConfig(cfg);
  if (initial.length !== 2 || !initial.every(Number.isFinite)) throw new Error('Initial state must be a finite pair');
  if (!Number.isInteger(steps) || steps < 1 || steps > 1000) throw new Error('Steps must be an integer from 1 to 1000');
  if (methods.some(method => !METHODS.includes(method))) throw new Error('Unknown gradient method');
  const traces = [...new Set(methods)].map(method => ({ method, points: [[...initial]], reason: null }));
  const snapshot = () => ({ traces: traces.map(trace => ({ ...trace, points: trace.points.map(point => [...point]) })), done: traces.every(trace => trace.reason !== null) });
  yield snapshot();
  if (!traces.length) return;
  for (let k = 0; k < steps; k++) {
    for (const trace of traces) {
      if (trace.reason !== null) continue;
      const point = trace.points.at(-1);
      const estimate = k === 0 && initialEstimates?.[trace.method]
        ? initialEstimates[trace.method]
        : evaluate(point, cfg, [trace.method], false).estimates[trace.method];
      const step = ascentStep(point, estimate.mean, cfg);
      if (step.reason) trace.reason = step.reason;
      else {
        trace.points.push(step.next);
        if (k + 1 === steps) trace.reason = 'limit';
      }
    }
    const progress = snapshot();
    yield progress;
    if (progress.done) return;
  }
}

/** Common innovations pair all estimators, with independent reference and outcome streams. */
export function compareAt(initial, cfg, referenceCount = REFERENCE_SAMPLES) {
  validateConfig(cfg);
  if (initial.length !== 2 || !initial.every(Number.isFinite)) throw new Error('Initial state must be a finite pair');
  if (!Number.isInteger(referenceCount) || referenceCount < 2) throw new Error('At least two reference samples are required');
  const random = gaussianGenerator(cfg.seed);
  const noise = new Float64Array(2 * cfg.horizon);
  const rf = moments(2), hy = moments(2), pw = moments(2), value = moments(1), event = moments(1), difference = moments(2);
  const checkpoints = new Set([16, 64, 256, 1024, 4096, cfg.samples].filter(n => n <= cfg.samples));
  const convergence = [], paths = [];
  const estimateStart = performance.now();
  for (let i = 0; i < cfg.samples; i++) {
    for (let k = 0; k < noise.length; k++) noise[k] = random();
    const result = sample(initial, cfg, noise, i < 32);
    rf.add(result.reinforce); hy.add(result.hybrid); pw.add(result.pathwise); value.add([result.probability]); event.add([result.reward]);
    difference.add(result.reinforce.map((g, j) => g - result.pathwise[j]));
    if (result.path) paths.push({ points: result.path, reward: result.reward });
    if (checkpoints.has(i + 1)) convergence.push({ count: i + 1, reinforce: rf.result(), hybrid: hy.result(), pathwise: pw.result() });
  }
  const estimatorMilliseconds = performance.now() - estimateStart;
  const referenceRandom = gaussianGenerator((cfg.seed ^ 0xa511e9b3) >>> 0);
  const ref = moments(2), refValue = moments(1);
  for (let i = 0; i < referenceCount; i++) {
    for (let k = 0; k < noise.length; k++) noise[k] = referenceRandom();
    const result = sample(initial, cfg, noise);
    ref.add(result.pathwise); refValue.add([result.probability]);
  }
  const estimates = { reinforce: rf.result(), hybrid: hy.result(), pathwise: pw.result(), reference: ref.result() };
  const names = Object.keys(estimates);
  const updates = Object.fromEntries(names.map(name => [name, clippedUpdate(estimates[name].mean, cfg)]));
  const destinations = names.map(name => initial.map((x, j) => x + updates[name][j]));
  const evaluationRandom = gaussianGenerator((cfg.seed ^ 0x63d83595) >>> 0);
  const baseline = moments(1), gains = names.map(() => moments(1)), after = names.map(() => moments(1));
  for (let i = 0; i < referenceCount; i++) {
    for (let k = 0; k < noise.length; k++) noise[k] = evaluationRandom();
    const before = probabilitySample(initial, cfg, noise);
    baseline.add([before]);
    destinations.forEach((point, j) => {
      const probability = probabilitySample(point, cfg, noise);
      gains[j].add([probability - before]); after[j].add([probability]);
    });
  }
  const reference = estimates.reference.mean;
  names.forEach((name, j) => {
    const estimate = estimates[name];
    const norm = Math.hypot(...estimate.mean), refNorm = Math.hypot(...reference);
    const dot = estimate.mean.reduce((sum, value, k) => sum + value * reference[k], 0);
    estimate.norm = norm;
    estimate.cosine = norm > 1e-12 && refNorm > 1e-12 ? Math.max(-1, Math.min(1, dot / (norm * refNorm))) : null;
    estimate.error = Math.hypot(...estimate.mean.map((g, k) => g - reference[k]));
    estimate.update = updates[name];
    estimate.gain = gains[j].result();
    estimate.after = after[j].result();
  });
  return { initial, cfg, estimates, convergence, paths, value: value.result(), event: event.result(), referenceValue: refValue.result(), baseline: baseline.result(), difference: difference.result(), referenceCount, estimatorMilliseconds };
}

export function deterministicPath(initial, cfg, steps = cfg.horizon) {
  const path = [[...initial]];
  for (let i = 0; i < steps; i++) path.push(transitionMean(path.at(-1), cfg.dt, cfg.field));
  return path;
}

/** Locate the finite-horizon zero-terminal-coordinate contour, not an infinite-time separatrix. */
export function boundaryAt(y, cfg) {
  if (cfg.field !== 'coupled') throw new Error('Monotone boundary search is only valid for the coupled field');
  let left = -1.5, right = 1.5;
  for (let i = 0; i < 40; i++) {
    const middle = (left + right) / 2;
    if (deterministicPath([middle, y], cfg).at(-1)[0] > 0) right = middle;
    else left = middle;
  }
  return (left + right) / 2;
}
