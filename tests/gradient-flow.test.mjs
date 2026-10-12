import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGradientFlowTimeline,
  gradientFlowProgress,
  GRADIENT_BRANCH as B,
} from "../src/lib/value-gradients/gradient-flow.mjs";

test("reverse flow begins at the rightmost state and adds each local reward", () => {
  const timeline = createGradientFlowTimeline(3);
  assert.deepEqual(timeline.nodes[0], { key: "state-3", at: 0 });
  assert.equal(timeline.edges.length, 18);
  const rewards = timeline.nodes.filter(({ key }) => key.startsWith("reward"));
  assert.deepEqual(
    rewards.map(({ key }) => key),
    ["reward-2", "reward-1", "reward-0"],
  );
  assert(rewards.every(({ at }) => at > 0));
  assert(timeline.duration > Math.max(...timeline.nodes.map(({ at }) => at)));
});

test("each action waits for downstream and reward contributions before the policy propagates", () => {
  const { edges, nodes } = createGradientFlowTimeline(3);
  for (let step = 0; step < 3; step++) {
    const edge = (branch) =>
      edges.find((e) => e.step === step && e.branch === branch);
    const node = (key) => nodes.find((n) => n.key === key).at;
    const action = edge(B.ACTION_TO_POLICY);
    const policy = edge(B.POLICY_TO_STATE);
    for (const branch of [
      B.NEXT_STATE_TO_STATE,
      B.NEXT_STATE_TO_ACTION,
      B.REWARD_TO_STATE,
      B.REWARD_TO_ACTION,
    ]) {
      assert.equal(edge(branch).start, node(`reward-${step}`));
      assert(edge(branch).start >= node(`state-${step + 1}`));
      assert.equal(edge(branch).start + edge(branch).duration, action.start);
    }
    assert.equal(node(`action-${step}`), action.start);
    assert.equal(action.start + action.duration, policy.start);
    assert.equal(node(`policy-${step}`), policy.start);
    assert.equal(node(`state-${step}`), policy.start + policy.duration);
  }
});

test("stroke progress stays within the edge and advances from source to destination", () => {
  assert.equal(gradientFlowProgress(0, 100, 200), 0);
  assert.equal(gradientFlowProgress(100, 100, 200), 0);
  assert.equal(gradientFlowProgress(200, 100, 200), 0.5);
  assert.equal(gradientFlowProgress(300, 100, 200), 1);
  assert.equal(gradientFlowProgress(400, 100, 200), 1);
});
