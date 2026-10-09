import assert from "node:assert/strict";
import test from "node:test";
import { createExplorerEvaluator } from "../src/lib/value-gradients/evaluation.mjs";
import {
  DEFAULTS,
  FIELDS,
  createGradientEvaluator,
} from "../src/lib/value-gradients/simulation.mjs";

const methods = ["reinforce", "pathwise"];

for (const [field, definition] of Object.entries(FIELDS)) {
  test(`${field} display estimates match the source with the full preview`, () => {
    const cfg = { ...DEFAULTS, field, samples: 128 };
    const actual = createExplorerEvaluator()(definition.initial, cfg);
    const expected = createGradientEvaluator()(
      definition.initial,
      cfg,
      methods,
    );
    assert.deepEqual(actual.estimates, expected.estimates);
    assert.equal(actual.paths.length, cfg.samples);
    assert.deepEqual(actual.paths.slice(0, 32), expected.paths);
    for (const path of actual.paths) {
      assert.equal(path.points.length, cfg.horizon + 1);
      assert.deepEqual(path.points[0], definition.initial);
      assert.ok(path.points.flat().every(Number.isFinite));
    }
  });
}

test("budgets use all samples for estimation and draw at most 256 nested paths", () => {
  const evaluate = createExplorerEvaluator();
  const initial = FIELDS.coupled.initial;
  let previous = [];
  for (const samples of [4, 16, 64, 256, 1024, 4096, 8192]) {
    const result = evaluate(initial, { ...DEFAULTS, horizon: 3, samples });
    assert.equal(result.paths.length, Math.min(256, samples));
    for (const estimate of Object.values(result.estimates))
      assert.equal(estimate.count, samples);
    assert.deepEqual(result.paths.slice(0, previous.length), previous);
    assert.deepEqual(Object.keys(result.estimates), methods);
    previous = result.paths;
  }
});

test("method switches change estimates without hiding sampled trajectories", () => {
  const evaluate = createExplorerEvaluator();
  const cfg = { ...DEFAULTS, samples: 16 };
  const initial = FIELDS.coupled.initial;
  const both = evaluate(initial, cfg);
  for (const selected of [["reinforce"], ["pathwise"], []]) {
    const result = evaluate(initial, cfg, selected);
    assert.deepEqual(Object.keys(result.estimates), selected);
    assert.deepEqual(result.paths, both.paths);
    for (const method of selected)
      assert.deepEqual(result.estimates[method], both.estimates[method]);
  }
});

test("resampling and moving the initial state update the actual trajectories", () => {
  const evaluate = createExplorerEvaluator();
  const cfg = { ...DEFAULTS, samples: 16 };
  const initial = FIELDS.coupled.initial;
  const first = evaluate(initial, cfg);
  assert.deepEqual(evaluate(initial, cfg), first);
  const resampled = evaluate(initial, { ...cfg, seed: cfg.seed + 1 });
  assert.notDeepEqual(resampled.paths, first.paths);
  const moved = evaluate([0.2, 0.3], cfg);
  assert.notDeepEqual(moved.paths, first.paths);
  for (const path of moved.paths) assert.deepEqual(path.points[0], [0.2, 0.3]);
  assert.deepEqual(evaluate(initial, cfg), first);
});

test("the explorer rejects unsupported methods and invalid configurations", () => {
  const evaluate = createExplorerEvaluator();
  for (const method of ["hybrid", "reference"])
    assert.throws(
      () => evaluate([0, 0], DEFAULTS, [method]),
      /Unknown explorer/,
    );
  assert.throws(() => evaluate([NaN, 0], DEFAULTS), /finite pair/);
  assert.throws(() => evaluate([0, 0], { ...DEFAULTS, samples: 0 }));
});
