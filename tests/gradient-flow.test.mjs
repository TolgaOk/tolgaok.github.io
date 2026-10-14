import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGradientFlowTimeline,
  gradientEdgeNodes,
  gradientFlowProgress,
  GRADIENT_BRANCH as B,
} from "../src/lib/value-gradients/gradient-flow.mjs";

test("reverse flow begins at the rightmost state and covers every edge once", () => {
  const timeline = createGradientFlowTimeline(3);
  assert.deepEqual(timeline.nodes[0], { key: "state-3", at: 0 });
  assert.equal(timeline.edges.length, 3 * Object.keys(B).length);
  const keys = new Set(
    timeline.edges.map(({ step, branch }) => `${step}:${branch}`),
  );
  assert.equal(keys.size, timeline.edges.length);
  const rewards = timeline.nodes.filter(({ key }) => key.startsWith("reward"));
  assert.deepEqual(
    rewards.map(({ key }) => key),
    ["reward-2", "reward-1", "reward-0"],
  );
  assert(timeline.duration > Math.max(...timeline.nodes.map(({ at }) => at)));
});

test("each derivative leaves a lit node and arrives no later than its destination lights", () => {
  const { edges, nodes } = createGradientFlowTimeline(3);
  const at = Object.fromEntries(nodes.map(({ key, at }) => [key, at]));
  for (const { step, branch, start, duration } of edges) {
    const [source, destination] = gradientEdgeNodes(step, branch);
    assert(duration > 0);
    assert(start >= at[source], `${source} lights before its edge starts`);
    assert(
      start + duration <= at[destination],
      `${destination} waits for its edge`,
    );
  }
});

test("a node lights exactly when its last incoming derivative arrives", () => {
  const { edges, nodes } = createGradientFlowTimeline(3);
  for (const { key, at } of nodes) {
    const arrivals = edges
      .filter(({ step, branch }) => gradientEdgeNodes(step, branch)[1] === key)
      .map(({ start, duration }) => start + duration);
    if (arrivals.length) assert.equal(at, Math.max(...arrivals), key);
  }
});

test("each state collects from its transition, reward, and policy", () => {
  const { edges } = createGradientFlowTimeline(3);
  for (let step = 0; step < 3; step++) {
    const into = edges
      .filter((e) => gradientEdgeNodes(e.step, e.branch)[1] === `state-${step}`)
      .map(({ branch }) => branch)
      .sort();
    assert.deepEqual(
      into,
      [B.TRANSITION_TO_STATE, B.REWARD_TO_STATE, B.POLICY_TO_STATE].sort(),
    );
  }
});

test("stroke progress stays within the edge and advances from source to destination", () => {
  assert.equal(gradientFlowProgress(0, 100, 200), 0);
  assert.equal(gradientFlowProgress(100, 100, 200), 0);
  assert.equal(gradientFlowProgress(200, 100, 200), 0.5);
  assert.equal(gradientFlowProgress(300, 100, 200), 1);
  assert.equal(gradientFlowProgress(400, 100, 200), 1);
});
