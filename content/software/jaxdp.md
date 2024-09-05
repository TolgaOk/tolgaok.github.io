---
title: jaxdp
issueNo: 3
date: 04.09.2024
tags:
  - RL
  - DP
  - JAX
---

## [Jaxdp](https://github.com/TolgaOk/jaxdp)
 is a vectorized Dynamic Programing package built on JAX for finite MDPs.

> [!info]
> Version: 0.1.0


## Example

In jaxdp, you define the value update rule for the simplest case and let JAX vectorize it for multiple initial values or/and MDPs.

```python title="Vectorized Algorithms"
from jaxdp.iterations.iteration import value_iteration_update
from jax import vmap

...

# Regular VI step
regular_vi_step = value_iteration_update(value, mdp, gamma)

# Multiple values VI step
mv_vi_step = vmap(value_iteration_update, in_axes=(0, None, None))(values, mdp, gamma)

# Multiple values multiple MDPs VI step
mvmm_vi_step = vmap(mv_vi_step, in_axes=(None, 0, None))(values, mdps, gamma)
```

Similarly, you can vectorize MDPs with different parameters.

> [!warning]
> MDPs should have the same state and action sizes.

```python title="Vectorized garnet MDPs with different seeds"
import jax.numpy as jnp
import jax.tree_util

from jaxdp.mdp.garnet import garnet_mdp as make_garnet


n_mdp = 10
key = jax.random.PRNGKey(42)

mdps = [make_garnet(state_size=1000, action_size=10, key=key,
                    branch_size=4, min_reward=-1, max_reward=1)
        for key in jrd.split(key, n_mdp)]

# Stacked MDP
stacked_mdp = jax.tree_map(lambda *mdps: jnp.stack(mdps), *mdps)
```
