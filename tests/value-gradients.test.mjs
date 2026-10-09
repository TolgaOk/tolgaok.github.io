import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, FIELDS, METHODS, drift, transitionMean, transitionJacobian, normalCdf, normalPdf, normalLogCdf, inverseMillsRatio, rewardHeadScore, gaussianGenerator, noisePool, sample, probabilitySample, moments, clippedUpdate, ascentStep, ascentPaths, compareAt, createGradientEvaluator, deterministicPath, boundaryAt, validateConfig } from '../src/lib/value-gradients/simulation.mjs';

const close = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) <= tolerance, `${a} ≠ ${b} within ${tolerance}`);
const vectorClose = (a, b, tolerance) => a.forEach((x, i) => close(x, b[i], tolerance));

test('equilibria and exact discrete Jacobian', () => {
  for (const point of [[-1, 0], [0, 0], [1, 0]]) vectorClose(drift(point), [0, 0]);
  const point = [.31, -.7], dt = .02, delta = 1e-6;
  const jacobian = transitionJacobian(point, dt);
  for (let j = 0; j < 2; j++) {
    const plus = [...point], minus = [...point]; plus[j] += delta; minus[j] -= delta;
    const hi = transitionMean(plus, dt), lo = transitionMean(minus, dt);
    for (let i = 0; i < 2; i++) close(jacobian[i][j], (hi[i] - lo[i]) / (2 * delta), 1e-9);
  }
});

test('normal CDF agrees with independent tabulated values and symmetry', () => {
  for (const [z, value] of [[0, .5], [1, .8413447460685429], [2, .9772498680518208], [3, .9986501019683699], [-1, .15865525393145707], [8, .9999999999999993]]) close(normalCdf(z), value, 1e-14);
  for (const z of [.05, .4, 1.3, 5]) close(normalCdf(z) + normalCdf(-z), 1);
  close(normalCdf(-40), 0); close(normalCdf(40), 1);
});

test('Bernoulli head score differentiates the log probability of both reward outcomes', () => {
  for (const z of [-40, -12, -5, -4, -1, 0, .8, 4, 5, 12, 40]) for (const reward of [0, 1]) {
    const sign = reward ? 1 : -1, h = 1e-5;
    const derivative = (normalLogCdf(sign * (z + h)) - normalLogCdf(sign * (z - h))) / (2 * h);
    close(rewardHeadScore(z, reward), derivative, 1e-7 * Math.max(1, Math.abs(derivative)));
  }
  assert.throws(() => rewardHeadScore(0, 2));
});

test('head log probabilities and inverse Mills ratios match independent erfc tail values', () => {
  const values = [
    [-30, -454.3212439563431, 30.03325966743015],
    [-20, -203.91715537109724, 20.04975306852714],
    [-10, -53.23128515051246, 10.098093233962423],
    [-5, -15.064998393988724, 5.186503967125832],
    [-4, -10.36010148652729, 4.225607144489467],
    [0, -.6931471805599453, .7978845608028654],
  ];
  for (const [z, logQ, ratio] of values) {
    close(normalLogCdf(z), logQ, 1e-10);
    close(inverseMillsRatio(z), ratio, 1e-10);
  }
  close(normalLogCdf(10) / -7.619853024160593e-24, 1, 1e-12);
});

test('the hybrid scores the Bernoulli reward rather than the sampled Gaussian transition', () => {
  const cfg = { ...DEFAULTS, horizon: 1 };
  const first = sample([0, 0], cfg, [1, 0]), second = sample([0, 0], cfg, [2, 0]);
  assert.equal(first.reward, 1); assert.equal(second.reward, 1);
  assert.deepEqual(first.hybrid, second.hybrid);
  assert.notDeepEqual(first.reinforce, second.reinforce);
  vectorClose(first.hybrid, first.pathwise.map(value => 2 * value));
  assert.deepEqual(sample([0, 0], cfg, [-1, 0]).hybrid, [0, 0]);
});

test('integrating the sampled head reward recovers the pathwise gradient for every field', () => {
  for (const field of Object.keys(FIELDS)) for (const horizon of [1, 8, 64, 256]) {
    const cfg = { ...DEFAULTS, field, horizon, sigma: .2 }, point = [.012, -.01];
    const noise = noisePool(1, horizon, 44), s = cfg.sigma * Math.sqrt(cfg.dt);
    const prefix = sample(point, cfg, noise, true).path[horizon - 1];
    const z = transitionMean(prefix, cfg.dt, field)[0] / s;
    noise[2 * (horizon - 1)] = -z + 1;
    const positive = sample(point, cfg, noise);
    noise[2 * (horizon - 1)] = -z - 1;
    const negative = sample(point, cfg, noise);
    assert.equal(positive.reward, 1); assert.equal(negative.reward, 0);
    assert.deepEqual(negative.hybrid, [0, 0]);
    assert.deepEqual(positive.pathwise, negative.pathwise);
    const q = Math.exp(normalLogCdf(z));
    positive.pathwise.forEach((g, j) => close(q * positive.hybrid[j], g, 1e-10 * Math.max(1, Math.abs(g))));
  }
});

test('the reward-head score propagates through exact prefix Jacobians, not through the indicator', () => {
  for (const field of Object.keys(FIELDS)) for (const horizon of [1, 8, 64, 256]) {
    const cfg = { ...DEFAULTS, field, horizon, sigma: .2 }, point = [.012, -.01];
    const noise = noisePool(1, horizon, 44), s = cfg.sigma * Math.sqrt(cfg.dt);
    const headMean = initial => {
      let state = initial;
      for (let k = 0; k < horizon - 1; k++) state = transitionMean(state, cfg.dt, field).map((value, j) => value + s * noise[2 * k + j]);
      return transitionMean(state, cfg.dt, field)[0] / s;
    };
    noise[2 * (horizon - 1)] = -headMean(point) + 1;
    const result = sample(point, cfg, noise);
    assert.equal(result.reward, 1);
    for (let j = 0; j < 2; j++) {
      const plus = [...point], minus = [...point]; plus[j] += 1e-6; minus[j] -= 1e-6;
      const derivative = (normalLogCdf(headMean(plus)) - normalLogCdf(headMean(minus))) / 2e-6;
      close(result.hybrid[j], derivative, 5e-5 * Math.max(1, Math.abs(derivative)));
    }
  }
});

test('hybrid and pathwise Monte Carlo means agree across all fields', () => {
  for (const field of Object.keys(FIELDS)) {
    const cfg = { ...DEFAULTS, field, horizon: 16, sigma: .2 }, random = gaussianGenerator(184);
    const noise = new Float64Array(32), difference = moments(2), hy = moments(2), pw = moments(2);
    for (let i = 0; i < 65536; i++) {
      for (let j = 0; j < noise.length; j++) noise[j] = random();
      const result = sample([.01, -.01], cfg, noise);
      difference.add(result.hybrid.map((g, j) => g - result.pathwise[j]));
      hy.add(result.hybrid); pw.add(result.pathwise);
    }
    const stats = difference.result();
    stats.mean.forEach((mean, j) => assert.ok(Math.abs(mean) < 5 * stats.se[j], `${field}: hybrid/pathwise mean mismatch`));
    hy.result().se.forEach((se, j) => assert.ok(se > pw.result().se[j]));
  }
});

test('a synthetic rare head success retains a finite score when its probability underflows', () => {
  const cfg = { ...DEFAULTS, horizon: 1 };
  const result = sample([-1, 0], cfg, [100, 0]);
  assert.equal(result.reward, 1);
  assert.equal(result.probability, 0);
  assert.deepEqual(result.pathwise, [0, 0]);
  assert.ok(result.hybrid.every(Number.isFinite));
  assert.ok(result.hybrid[0] > 1000);
  const z = -1 / (cfg.sigma * Math.sqrt(cfg.dt));
  assert.ok(Number.isFinite(normalLogCdf(z)));
  assert.ok(inverseMillsRatio(z) > -z && inverseMillsRatio(z) < -z - 1 / z);
});

test('Gaussian streams are deterministic, nested and approximately standard normal', () => {
  const a = noisePool(100000, 1, 37), b = noisePool(10, 1, 37);
  assert.deepEqual(a.slice(0, b.length), b);
  const stats = moments(2);
  for (let i = 0; i < a.length; i += 2) stats.add([a[i], a[i + 1]]);
  for (const mean of stats.result().mean) assert.ok(Math.abs(mean) < .015);
  for (const se of stats.result().se) close(se * Math.sqrt(100000), 1, .015);
  let cross = 0;
  for (let i = 0; i < a.length; i += 2) cross += a[i] * a[i + 1];
  assert.ok(Math.abs(cross / 100000) < .015);
  assert.notDeepEqual(noisePool(10, 1, 38), b);
});

test('one-step pathwise derivative matches the analytic Gaussian event derivative', () => {
  const cfg = { ...DEFAULTS, horizon: 1 }, point = [.01, -.1];
  const result = sample(point, cfg, [.3, -.2]);
  const mean = transitionMean(point, cfg.dt), jacobian = transitionJacobian(point, cfg.dt), s = cfg.sigma * Math.sqrt(cfg.dt);
  close(result.probability, normalCdf(mean[0] / s));
  vectorClose(result.pathwise, jacobian[0].map(value => value * normalPdf(mean[0] / s) / s));
});

test('pathwise gradient matches fixed-noise finite differences at every tested horizon', () => {
  for (const horizon of [1, 8, 64, 256]) {
    const cfg = { ...DEFAULTS, horizon, sigma: .2 };
    const point = [boundaryAt(.4, cfg), .4], noise = noisePool(1, horizon, 44), delta = 1e-5;
    const result = sample(point, cfg, noise);
    for (let j = 0; j < 2; j++) {
      const plus = [...point], minus = [...point]; plus[j] += delta; minus[j] -= delta;
      const numerical = (probabilitySample(plus, cfg, noise) - probabilitySample(minus, cfg, noise)) / (2 * delta);
      close(result.pathwise[j], numerical, 2e-4 * Math.max(1, Math.abs(numerical)));
    }
  }
});

test('REINFORCE matches the fixed-observation likelihood derivative, not a rollout derivative', () => {
  const cfg = { ...DEFAULTS, horizon: 8 }, point = [.2, -.2], noise = noisePool(1, 8, 12);
  const result = sample(point, cfg, noise, true);
  assert.equal(result.reward, 1);
  function logLikelihood(initial) {
    let sum = 0;
    for (let k = 0; k < cfg.horizon; k++) {
      const mean = transitionMean(k === 0 ? initial : result.path[k], cfg.dt);
      sum -= result.path[k + 1].reduce((acc, x, j) => acc + (x - mean[j]) ** 2, 0) / (2 * cfg.sigma ** 2 * cfg.dt);
    }
    return sum;
  }
  for (let j = 0; j < 2; j++) {
    const plus = [...point], minus = [...point]; plus[j] += 1e-6; minus[j] -= 1e-6;
    close(result.reinforce[j], (logLikelihood(plus) - logLikelihood(minus)) / 2e-6, 1e-6);
  }
});

test('integrating the last event ignores final noise and preserves the literal reward', () => {
  const cfg = { ...DEFAULTS, horizon: 4 }, noise = new Float64Array(8);
  noise[6] = 100;
  const positive = sample([0, 0], cfg, noise, true);
  noise[6] = -100;
  const negative = sample([0, 0], cfg, noise, true);
  assert.equal(positive.reward, 1); assert.equal(negative.reward, 0);
  close(positive.probability, .5);
  assert.deepEqual(positive.pathwise, negative.pathwise);
  vectorClose(negative.reinforce, [0, 0]);
  assert.equal(positive.path.length, 5);
});

test('odd drift implies reflected probability complements and equal pathwise derivatives', () => {
  const noise = noisePool(1, DEFAULTS.horizon, 7), point = [-.2, .6];
  const first = sample(point, DEFAULTS, noise), reflected = sample(point.map(x => -x), DEFAULTS, noise.map(x => -x));
  close(first.probability + reflected.probability, 1);
  vectorClose(first.pathwise, reflected.pathwise);
});

test('paired REINFORCE and pathwise means agree within their measured sampling error', () => {
  const cfg = { ...DEFAULTS, horizon: 16, sigma: .2 }, point = [-.035, .2];
  const random = gaussianGenerator(184), noise = new Float64Array(32), stats = moments(2);
  for (let i = 0; i < 65536; i++) {
    for (let j = 0; j < noise.length; j++) noise[j] = random();
    const result = sample(point, cfg, noise);
    stats.add(result.reinforce.map((g, j) => g - result.pathwise[j]));
  }
  const result = stats.result();
  result.mean.forEach((mean, j) => assert.ok(Math.abs(mean) < 5 * result.se[j]));
});

test('Welford standard errors agree with a hand calculation', () => {
  const stats = moments(2); stats.add([1, 2]); stats.add([3, 6]);
  assert.deepEqual(stats.result(), { count: 2, mean: [2, 4], se: [1, 2] });
});

test('update cap keeps the direction and leaves zero gradients unchanged', () => {
  vectorClose(clippedUpdate([0, 0], DEFAULTS), [0, 0]);
  const update = clippedUpdate([100, -100], DEFAULTS);
  close(Math.hypot(...update), DEFAULTS.cap);
  close(update[0], -update[1]);
  vectorClose(clippedUpdate([1, 2], DEFAULTS), [.02, .04]);
});

test('end-to-end comparison is reproducible with independent reference and nested budgets', () => {
  const cfg = { ...DEFAULTS, horizon: 8, samples: 64 }, point = [-.02, .2];
  const first = compareAt(point, cfg, 128), repeat = compareAt(point, cfg, 128), larger = compareAt(point, { ...cfg, samples: 256 }, 128);
  assert.deepEqual(first.estimates, repeat.estimates);
  assert.deepEqual(first.paths, repeat.paths);
  assert.deepEqual(first.estimates.reference.mean, larger.estimates.reference.mean);
  assert.deepEqual(first.convergence.at(-1), larger.convergence.find(row => row.count === 64));
  for (const estimate of Object.values(first.estimates)) {
    close(estimate.after.mean[0] - first.baseline.mean[0], estimate.gain.mean[0]);
    assert.ok(Math.hypot(...estimate.update) <= .100000001);
  }
  assert.equal(first.paths.length, 32);
});

test('each selectable field has the advertised equilibria and exact transition Jacobian', () => {
  for (const [field, definition] of Object.entries(FIELDS)) {
    for (const point of definition.equilibria) vectorClose(drift(point, field), [0, 0], 1e-12);
    for (const point of [[.21, -.4], [-.7, .8]]) {
      const matrix = transitionJacobian(point, .02, field);
      for (let j = 0; j < 2; j++) {
        const plus = [...point], minus = [...point]; plus[j] += 1e-6; minus[j] -= 1e-6;
        const hi = transitionMean(plus, .02, field), lo = transitionMean(minus, .02, field);
        for (let i = 0; i < 2; i++) close(matrix[i][j], (hi[i] - lo[i]) / 2e-6, 1e-9);
      }
    }
  }
});

test('all fields propagate the full pathwise Jacobian through both coordinates', () => {
  for (const field of Object.keys(FIELDS)) for (const horizon of [1, 8, 64, 256]) {
    const cfg = { ...DEFAULTS, field, horizon, sigma: .2 }, point = [.012, -.01], noise = noisePool(1, horizon, 44);
    const result = sample(point, cfg, noise);
    for (let j = 0; j < 2; j++) {
      const plus = [...point], minus = [...point]; plus[j] += 1e-5; minus[j] -= 1e-5;
      const numerical = (probabilitySample(plus, cfg, noise) - probabilitySample(minus, cfg, noise)) / 2e-5;
      close(result.pathwise[j], numerical, 5e-4 * Math.max(1, Math.abs(numerical)));
    }
  }
});

test('REINFORCE scores both coordinates correctly for the additional fields', () => {
  for (const field of ['three', 'inertial']) {
    const cfg = { ...DEFAULTS, field, horizon: 8 }, point = [.2, .1], noise = noisePool(1, 8, 12);
    const result = sample(point, cfg, noise, true);
    assert.equal(result.reward, 1);
    const likelihood = initial => {
      const mean = transitionMean(initial, cfg.dt, field);
      return -result.path[1].reduce((sum, x, j) => sum + (x - mean[j]) ** 2, 0) / (2 * cfg.sigma ** 2 * cfg.dt);
    };
    for (let j = 0; j < 2; j++) {
      const plus = [...point], minus = [...point]; plus[j] += 1e-6; minus[j] -= 1e-6;
      close(result.reinforce[j], (likelihood(plus) - likelihood(minus)) / 2e-6, 1e-6);
    }
  }
});

test('live previews reproduce the full-estimator paths on every field and retain noise when dragged', () => {
  for (const field of Object.keys(FIELDS)) {
    const cfg = { ...DEFAULTS, field, horizon: 16, samples: 64 }, point = FIELDS[field].initial;
    const pool = noisePool(32, cfg.horizon, cfg.seed);
    const preview = Array.from({ length: 32 }, (_, i) => {
      const result = sample(point, cfg, pool.subarray(i * 32, (i + 1) * 32), true);
      return { points: result.path, reward: result.reward };
    });
    assert.deepEqual(preview, compareAt(point, cfg, 64).paths);
    const moved = sample([point[0] + .03, point[1]], cfg, pool.subarray(0, 32), true);
    assert.notDeepEqual(preview[0].points, moved.path);
    for (let k = 0; k < cfg.horizon; k++) {
      const mean = transitionMean(moved.path[k], cfg.dt, field);
      vectorClose(moved.path[k + 1].map((x, j) => (x - mean[j]) / (cfg.sigma * Math.sqrt(cfg.dt))), Array.from(pool.subarray(k * 2, k * 2 + 2)), 1e-12);
    }
  }
});

test('additional fields have matching Monte Carlo score and pathwise expectations', () => {
  for (const field of ['three', 'inertial']) {
    const cfg = { ...DEFAULTS, field, horizon: 16, sigma: .2 }, random = gaussianGenerator(184), noise = new Float64Array(32), stats = moments(2);
    for (let i = 0; i < 65536; i++) {
      for (let j = 0; j < noise.length; j++) noise[j] = random();
      const result = sample([.01, -.01], cfg, noise);
      stats.add(result.reinforce.map((g, j) => g - result.pathwise[j]));
    }
    const result = stats.result();
    result.mean.forEach((mean, j) => assert.ok(Math.abs(mean) < 5 * result.se[j]));
  }
});

test('live gradient evaluation matches full estimates and keeps both sample budgets', () => {
  const evaluate = createGradientEvaluator(128);
  for (const field of Object.keys(FIELDS)) {
    const cfg = { ...DEFAULTS, field, horizon: 8, samples: 64 }, point = FIELDS[field].initial;
    const live = evaluate(point, cfg), full = compareAt(point, cfg, 128);
    assert.deepEqual(live.paths, full.paths);
    for (const name of METHODS) {
      for (const key of ['count', 'mean', 'se', 'update']) assert.deepEqual(live.estimates[name][key], full.estimates[name][key]);
    }
    assert.equal(live.estimates.pathwise.count, 64);
    assert.equal(live.estimates.reference.count, 128);
  }
});

test('live evaluator reuses innovations but recomputes gradients as state and controls change', () => {
  const evaluate = createGradientEvaluator(64), base = { ...DEFAULTS, horizon: 8, samples: 64 };
  const changes = [{}, { field: 'three' }, { field: 'inertial' }, { sigma: .2 }, { dt: .01 }, { rate: .04, cap: .2 }, { horizon: 16 }, { samples: 128 }, { seed: 38 }, {}];
  for (const change of changes) {
    const cfg = { ...base, ...change };
    for (const point of [[.01, .02], [.03, .04]]) {
      const live = evaluate(point, cfg), full = compareAt(point, cfg, 64);
      for (const name of METHODS) {
        assert.deepEqual(live.estimates[name].mean, full.estimates[name].mean);
        assert.deepEqual(live.estimates[name].update, full.estimates[name].update);
      }
      assert.deepEqual(live.initial, point);
    }
  }
  const snapshot = evaluate([.01, .02], base);
  base.horizon = 12;
  assert.equal(snapshot.cfg.horizon, 8);
  assert.throws(() => createGradientEvaluator(1));
});

test('ascent steps use delta times the gradient with the same displacement cap', () => {
  const initial = [0, 0], gradient = [1, 2];
  const first = ascentStep(initial, gradient, { ...DEFAULTS, rate: .01 });
  vectorClose(first.next, [.01, .02]);
  assert.equal(first.reason, null);
  vectorClose(ascentStep(initial, gradient, DEFAULTS).next, [.02, .04]);
  const capped = ascentStep(initial, [100, -100], DEFAULTS);
  close(Math.hypot(...capped.update), .1);
  vectorClose(capped.next, clippedUpdate([100, -100], DEFAULTS));
  assert.deepEqual(initial, [0, 0]);
  assert.deepEqual(gradient, [1, 2]);
});

test('ascent steps stop at negligible gradients and plot boundaries without clamping', () => {
  assert.deepEqual(ascentStep([0, 0], [0, 0], DEFAULTS), { next: [0, 0], update: [0, 0], reason: 'zero' });
  for (const field of Object.keys(FIELDS)) {
    const cfg = { ...DEFAULTS, field }, point = [FIELDS[field].domain.x[1], 0];
    assert.deepEqual(ascentStep(point, [10, 0], cfg), { next: point, update: [0, 0], reason: 'boundary' });
    assert.equal(ascentStep(point, [-1, 0], cfg).reason, null);
  }
  assert.throws(() => ascentStep([0, 0], [NaN, 0], DEFAULTS));
});

test('all methods recompute gradients at their successive initial states', () => {
  for (const field of Object.keys(FIELDS)) for (const method of METHODS) {
    const cfg = { ...DEFAULTS, field, horizon: 8, samples: 64, rate: .005 };
    const evaluate = createGradientEvaluator(128);
    let point = [0, 0], moves = 0;
    for (let k = 0; k < 3; k++) {
      const result = evaluate(point, cfg);
      const step = ascentStep(point, result.estimates[method].mean, cfg);
      if (step.reason) break;
      vectorClose(step.next, point.map((x, j) => x + result.estimates[method].update[j]));
      point = step.next; moves++;
      assert.deepEqual(evaluate(point, cfg).paths[0].points[0], point);
    }
    assert.ok(moves > 0);
  }
});

test('selective evaluation matches full estimates and preserves the sampled context', () => {
  const cfg = { ...DEFAULTS, horizon: 8, samples: 64 }, point = [.01, -.02];
  const evaluate = createGradientEvaluator(128), full = evaluate(point, cfg);
  for (const method of METHODS) {
    const result = evaluate(point, cfg, [method], false);
    assert.deepEqual(Object.keys(result.estimates), [method]);
    assert.deepEqual(result.estimates[method], full.estimates[method]);
    assert.deepEqual(result.paths, []);
  }
  const empty = evaluate(point, cfg, []);
  assert.deepEqual(empty.estimates, {});
  assert.deepEqual(empty.paths, full.paths);
  assert.throws(() => evaluate(point, cfg, ['unknown']));
});

test('automatic ascent paths are independent exact updates from the same initial point', () => {
  for (const field of Object.keys(FIELDS)) {
    const cfg = { ...DEFAULTS, field, horizon: 8, samples: 64, rate: .005 }, initial = [0, 0];
    const evaluate = createGradientEvaluator(128);
    const progress = [...ascentPaths(initial, cfg, METHODS, 4, evaluate)];
    const final = progress.at(-1);
    assert.equal(final.done, true);
    for (const trace of final.traces) {
      const manual = [[...initial]];
      for (let k = 0; k < 4; k++) {
        const point = manual.at(-1), result = evaluate(point, cfg, [trace.method], false);
        const step = ascentStep(point, result.estimates[trace.method].mean, cfg);
        if (step.reason) break;
        manual.push(step.next);
      }
      assert.deepEqual(trace.points, manual);
    }
    assert.deepEqual(progress[0].traces.map(trace => trace.points), METHODS.map(() => [[0, 0]]));
    assert.deepEqual(initial, [0, 0]);
    const seeded = [...ascentPaths(initial, cfg, METHODS, 4, evaluate, evaluate(initial, cfg).estimates)];
    assert.deepEqual(seeded.at(-1), final);
  }
});

test('automatic paths validate counts and terminate zero and boundary directions independently', () => {
  const cfg = { ...DEFAULTS }, initial = [FIELDS.coupled.domain.x[1], 0];
  const evaluate = (_point, _cfg, [method]) => ({ estimates: { [method]: { mean: method === 'reinforce' ? [1, 0] : [0, 0] } } });
  const frames = [...ascentPaths(initial, cfg, METHODS, 20, evaluate)];
  assert.equal(frames.at(-1).done, true);
  assert.deepEqual(frames.at(-1).traces.map(trace => trace.reason), METHODS.map(method => method === 'reinforce' ? 'boundary' : 'zero'));
  assert.ok(frames.at(-1).traces.every(trace => trace.points.length === 1));
  assert.deepEqual([...ascentPaths(initial, cfg, [], 20)], [{ traces: [], done: true }]);
  for (const steps of [0, 1001, NaN, 1.5]) assert.throws(() => [...ascentPaths(initial, cfg, METHODS, steps)]);
  assert.throws(() => [...ascentPaths(initial, cfg, ['unknown'], 2)]);
});

test('automatic paths accept all 1000 ascent steps without truncation', () => {
  const evaluate = () => ({ estimates: { pathwise: { mean: [.001, 0] } } });
  let final, frames = 0;
  for (const progress of ascentPaths([0, 0], DEFAULTS, ['pathwise'], 1000, evaluate)) { final = progress; frames++; }
  assert.equal(frames, 1001);
  assert.equal(final.done, true);
  assert.equal(final.traces[0].reason, 'limit');
  assert.equal(final.traces[0].points.length, 1001);
  vectorClose(final.traces[0].points.at(-1), [.02, 0]);
});

test('zero-noise outcome boundary bisects terminal sign', () => {
  const x = boundaryAt(.8, DEFAULTS);
  close(deterministicPath([x, .8], DEFAULTS).at(-1)[0], 0, 1e-9);
  assert.ok(deterministicPath([x - .01, .8], DEFAULTS).at(-1)[0] < 0);
  assert.ok(deterministicPath([x + .01, .8], DEFAULTS).at(-1)[0] > 0);
});

test('extreme supported controls remain finite on representative trajectories', () => {
  for (const field of Object.keys(FIELDS)) {
    const cfg = { ...DEFAULTS, field, horizon: 256, sigma: .35 }, noise = noisePool(64, 256, 5);
    const { x, y } = FIELDS[field].domain;
    for (const point of [[x[0], y[0]], [x[1], y[1]], [0, 0]]) {
      for (let i = 0; i < 64; i++) sample(point, cfg, noise.subarray(i * 512, (i + 1) * 512));
    }
  }
});

test('invalid process configurations and nonfinite results are rejected', () => {
  for (const change of [{ field: 'unknown' }, { sigma: 0 }, { dt: .5 }, { horizon: 0 }, { horizon: 2.5 }, { samples: 1 }, { seed: -1 }, { rate: NaN }]) assert.throws(() => validateConfig({ ...DEFAULTS, ...change }));
  assert.throws(() => compareAt([NaN, 0], DEFAULTS, 16));
  assert.throws(() => sample([1e100, 0], DEFAULTS, noisePool(1, 64, 1)));
});
