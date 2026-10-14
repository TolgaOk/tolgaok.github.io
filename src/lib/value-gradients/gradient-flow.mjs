// A visual reverse-mode schedule, not a numerical gradient calculation.
// Branch order matches the seven reverse dependencies in ValueGradientGraph.
export const GRADIENT_BRANCH = Object.freeze({
  NEXT_STATE_TO_TRANSITION: 0,
  TRANSITION_TO_STATE: 1,
  TRANSITION_TO_ACTION: 2,
  REWARD_TO_ACTION: 3,
  REWARD_TO_STATE: 4,
  ACTION_TO_POLICY: 5,
  POLICY_TO_STATE: 6,
});

/** Source and destination node keys of each reverse edge at a given step. */
export function gradientEdgeNodes(step, branch) {
  const B = GRADIENT_BRANCH;
  return {
    [B.NEXT_STATE_TO_TRANSITION]: [`state-${step + 1}`, `transition-${step}`],
    [B.TRANSITION_TO_STATE]: [`transition-${step}`, `state-${step}`],
    [B.TRANSITION_TO_ACTION]: [`transition-${step}`, `action-${step}`],
    [B.REWARD_TO_ACTION]: [`reward-${step}`, `action-${step}`],
    [B.REWARD_TO_STATE]: [`reward-${step}`, `state-${step}`],
    [B.ACTION_TO_POLICY]: [`action-${step}`, `policy-${step}`],
    [B.POLICY_TO_STATE]: [`policy-${step}`, `state-${step}`],
  }[branch];
}

/** @param {number} steps Number of complete transitions shown. */
export function createGradientFlowTimeline(steps = 3) {
  const B = GRADIENT_BRANCH;
  const incomingDuration = 500;
  const transitionDuration = 450;
  const actionDuration = 400;
  const policyDuration = 450;
  const stepPause = 250;
  const seedPause = 400;
  const edges = [];
  const nodes = [{ key: `state-${steps}`, at: 0 }];
  let start = seedPause;

  for (let step = steps - 1; step >= 0; step--) {
    const transitionAt = start + incomingDuration;
    const actionAt = transitionAt + transitionDuration;
    const policyAt = actionAt + actionDuration;
    const stateAt = policyAt + policyDuration;
    nodes.push(
      { key: `reward-${step}`, at: start },
      { key: `transition-${step}`, at: transitionAt },
      { key: `action-${step}`, at: actionAt },
      { key: `policy-${step}`, at: policyAt },
      { key: `state-${step}`, at: stateAt },
    );
    const edge = (branch, from, to) =>
      edges.push({ step, branch, start: from, duration: to - from });
    edge(B.NEXT_STATE_TO_TRANSITION, start, transitionAt);
    edge(B.REWARD_TO_ACTION, start, actionAt);
    edge(B.TRANSITION_TO_ACTION, transitionAt, actionAt);
    edge(B.TRANSITION_TO_STATE, transitionAt, stateAt);
    edge(B.ACTION_TO_POLICY, actionAt, policyAt);
    edge(B.POLICY_TO_STATE, policyAt, stateAt);
    // Starting late lets the reward's derivative reach the fork with the policy's.
    edge(B.REWARD_TO_STATE, actionAt, stateAt);
    start = stateAt + stepPause;
  }
  return { edges, nodes, duration: start + 1100 };
}

/** @param {number} time @param {number} start @param {number} duration */
export function gradientFlowProgress(time, start, duration) {
  return Math.max(0, Math.min(1, (time - start) / duration));
}
