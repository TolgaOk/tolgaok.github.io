import test from "node:test";
import assert from "node:assert/strict";
import { scaleLinear } from "d3";
import { streamlines } from "../src/components/charts/streamlines.mjs";
import { FIELDS, drift } from "../src/lib/value-gradients/simulation.mjs";

for (const [name, field] of Object.entries(FIELDS)) {
  test(`${name} streamlines are reproducible, finite and clipped`, () => {
    const x = scaleLinear().domain(field.domain.x).range([0, 900]);
    const y = scaleLinear().domain(field.domain.y).range([720, 0]);
    const curves = streamlines((point) => drift(point, name), x, y, 900, 720);
    assert.ok(curves.length > 10);
    assert.deepEqual(
      curves,
      streamlines((point) => drift(point, name), x, y, 900, 720),
    );
    for (const curve of curves) {
      assert.ok(curve.length <= 3001);
      for (const [px, py] of curve) {
        assert.ok(Number.isFinite(px) && Number.isFinite(py));
        assert.ok(px >= 0 && px < 900 && py >= 0 && py < 720);
      }
    }
  });
}

test("a zero field produces no streamlines", () => {
  const x = scaleLinear().domain([-1, 1]).range([0, 900]);
  const y = scaleLinear().domain([-1, 1]).range([720, 0]);
  assert.deepEqual(
    streamlines(() => [0, 0], x, y, 900, 720),
    [],
  );
});
