/**
 * Global cohort allocation via minimum-cost flow.
 *
 * Graph: source → student (cap 1, cost 0) → mentor (cap 1, cost −score) → sink (cap = capacity).
 * Only eligible pairs (consent, opt-in, visibility, exclusions, score ≥ threshold) get an edge.
 * We repeatedly augment along the cheapest residual path (Bellman–Ford, which handles negative
 * costs) and stop as soon as the cheapest path no longer has negative cost. Because successive
 * shortest-path costs are non-decreasing, this yields the flow of minimum total cost over all
 * flow values — i.e. the assignment with MAXIMUM total compatibility, with at most one mentor per
 * student and no mentor over capacity. Students without a profitable path stay unmatched.
 *
 * Deterministic: fixed node/edge ordering and strict relaxation make results reproducible.
 */

export interface AssignmentProblem {
  /** weights[s][m] = integer score, or null if the pair is not allowed. */
  weights: (number | null)[][];
  capacities: number[];
}

export interface AssignmentResult {
  /** mentor index per student, or −1 if unmatched */
  assignment: number[];
  total: number;
}

interface Edge {
  to: number;
  cap: number;
  cost: number;
  rev: number;
}

export function optimalAssignment({ weights, capacities }: AssignmentProblem): AssignmentResult {
  const S = weights.length;
  const M = capacities.length;
  const N = S + M + 2;
  const src = 0;
  const sink = N - 1;
  const g: Edge[][] = Array.from({ length: N }, () => []);
  const add = (u: number, v: number, cap: number, cost: number) => {
    g[u].push({ to: v, cap, cost, rev: g[v].length });
    g[v].push({ to: u, cap: 0, cost: -cost, rev: g[u].length - 1 });
  };

  for (let s = 0; s < S; s++) add(src, 1 + s, 1, 0);
  for (let s = 0; s < S; s++) {
    for (let m = 0; m < M; m++) {
      const w = weights[s][m];
      if (w === null || w === undefined) continue;
      if (!Number.isInteger(w)) throw new Error("weights must be integers");
      add(1 + s, 1 + S + m, 1, -w);
    }
  }
  for (let m = 0; m < M; m++) {
    const cap = Math.max(0, Math.floor(capacities[m]));
    if (cap > 0) add(1 + S + m, sink, cap, 0);
  }

  let totalCost = 0;
  // At most S augmentations (each saturates one source edge).
  for (let iter = 0; iter <= S; iter++) {
    const dist = new Array<number>(N).fill(Infinity);
    const prevNode = new Array<number>(N).fill(-1);
    const prevEdge = new Array<number>(N).fill(-1);
    dist[src] = 0;
    // Bellman–Ford
    for (let k = 0; k < N - 1; k++) {
      let changed = false;
      for (let u = 0; u < N; u++) {
        if (dist[u] === Infinity) continue;
        for (let i = 0; i < g[u].length; i++) {
          const e = g[u][i];
          if (e.cap > 0 && dist[u] + e.cost < dist[e.to]) {
            dist[e.to] = dist[u] + e.cost;
            prevNode[e.to] = u;
            prevEdge[e.to] = i;
            changed = true;
          }
        }
      }
      if (!changed) break;
    }
    if (dist[sink] === Infinity || dist[sink] >= 0) break; // no profitable augmentation left
    // Augment by 1 (all source edges have capacity 1).
    let v = sink;
    while (v !== src) {
      const u = prevNode[v];
      const e = g[u][prevEdge[v]];
      e.cap -= 1;
      g[v][e.rev].cap += 1;
      v = u;
    }
    totalCost += dist[sink];
  }

  const assignment = new Array<number>(S).fill(-1);
  for (let s = 0; s < S; s++) {
    for (const e of g[1 + s]) {
      // Edges leaving a student node toward mentor nodes are always forward edges.
      if (e.to > S && e.to <= S + M && e.cap === 0) {
        assignment[s] = e.to - 1 - S;
      }
    }
  }
  return { assignment, total: totalCost === 0 ? 0 : -totalCost };
}

/** Greedy baseline: repeatedly take the highest-scoring remaining pair. Used for comparison only. */
export function greedyAssignment({ weights, capacities }: AssignmentProblem): AssignmentResult {
  const pairs: { s: number; m: number; w: number }[] = [];
  weights.forEach((row, s) =>
    row.forEach((w, m) => {
      if (w !== null && w !== undefined) pairs.push({ s, m, w });
    }),
  );
  pairs.sort((a, b) => b.w - a.w || a.s - b.s || a.m - b.m);
  const assignment = new Array<number>(weights.length).fill(-1);
  const left = capacities.map((c) => Math.max(0, Math.floor(c)));
  let total = 0;
  for (const p of pairs) {
    if (p.w <= 0) continue;
    if (assignment[p.s] !== -1 || left[p.m] <= 0) continue;
    assignment[p.s] = p.m;
    left[p.m] -= 1;
    total += p.w;
  }
  return { assignment, total };
}

/** Exhaustive search for tests on small instances. Exponential — never call in the app. */
export function bruteForceAssignment({ weights, capacities }: AssignmentProblem): AssignmentResult {
  const S = weights.length;
  const left = capacities.map((c) => Math.max(0, Math.floor(c)));
  let best: AssignmentResult = { assignment: new Array(S).fill(-1), total: 0 };
  const cur = new Array<number>(S).fill(-1);
  const rec = (s: number, total: number) => {
    if (s === S) {
      if (total > best.total) best = { assignment: [...cur], total };
      return;
    }
    cur[s] = -1;
    rec(s + 1, total);
    for (let m = 0; m < left.length; m++) {
      const w = weights[s][m];
      if (w === null || w === undefined || left[m] <= 0 || w <= 0) continue;
      left[m]--;
      cur[s] = m;
      rec(s + 1, total + w);
      left[m]++;
      cur[s] = -1;
    }
  };
  rec(0, 0);
  return best;
}
