// Graph utils for the Concept Dependency DAG (spec 5.4).
// All functions are pure and operate on the parsed kinematics_dag.json.

/** Build adjacency helpers. children: id -> [ids that list id as prerequisite]. */
export function buildGraph(dag) {
  const nodes = new Map((dag.nodes ?? []).map((n) => [n.id, n]));
  const children = new Map([...nodes.keys()].map((id) => [id, []]));
  for (const n of nodes.values()) {
    for (const p of n.prerequisites ?? []) {
      if (children.has(p)) children.get(p).push(n.id);
    }
  }
  return { nodes, children };
}

/** DFS over prerequisites (self excluded), ordered from nearest to farthest. */
export function ancestors(graph, id) {
  const out = [];
  const seen = new Set([id]);
  const stack = [...(graph.nodes.get(id)?.prerequisites ?? [])];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (seen.has(cur)) continue;
    seen.add(cur);
    out.push(cur);
    stack.push(...(graph.nodes.get(cur)?.prerequisites ?? []));
  }
  return out;
}

/** DFS over reverse edges (self excluded). */
export function descendants(graph, id) {
  const out = [];
  const seen = new Set([id]);
  const stack = [...(graph.children.get(id) ?? [])];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (seen.has(cur)) continue;
    seen.add(cur);
    out.push(cur);
    stack.push(...(graph.children.get(cur) ?? []));
  }
  return out;
}

/** Topological order (roots first) via Kahn's algorithm. Deterministic: ties broken by dag.nodes order. */
export function topoOrder(graph, dag) {
  const indeg = new Map();
  for (const n of dag.nodes) indeg.set(n.id, (n.prerequisites ?? []).length);
  const order = [];
  const queue = dag.nodes.filter((n) => (n.prerequisites ?? []).length === 0).map((n) => n.id);
  while (queue.length > 0) {
    const id = queue.shift();
    order.push(id);
    for (const c of graph.children.get(id) ?? []) {
      indeg.set(c, indeg.get(c) - 1);
      if (indeg.get(c) === 0) queue.push(c);
    }
  }
  return order;
}

const fmt = (v) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));

/**
 * "lowest" = the unmastered ancestor (or self) with NO unmastered prerequisite:
 * the earliest node in topological order among the unmastered chain members.
 * Returns { root, trace } where trace is the backward walk for the audit panel.
 */
export function lowestUnmasteredAncestor(graph, dag, id, mastery) {
  const chain = [id, ...ancestors(graph, id)];
  const chainSet = new Set(chain);
  const order = topoOrder(graph, dag).filter((n) => chainSet.has(n));
  const isUnmastered = (n) => (mastery[n] ?? 0) < (graph.nodes.get(n)?.mastery_threshold ?? 0.8);

  // Backward walk from the gap node for the explainability trace.
  const trace = [];
  let cursor = id;
  const visited = new Set();
  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    const node = graph.nodes.get(cursor);
    const thr = node?.mastery_threshold ?? 0.8;
    const m = mastery[cursor] ?? 0;
    if (m < thr) {
      trace.push({ node: cursor, check: `mastery ${fmt(m)} < ${fmt(thr)}`, result: 'unmastered → go to prerequisites' });
      const next = (node?.prerequisites ?? []).find((p) => !visited.has(p))
        ?? (node?.prerequisites ?? [])[0];
      cursor = next;
    } else {
      trace.push({ node: cursor, check: `mastery ${fmt(m)} ≥ ${fmt(thr)}`, result: 'mastered ✓' });
      cursor = null;
    }
  }

  const root = order.find(isUnmastered) ?? null;
  if (root) trace.push({ node: root, result: 'ROOT CAUSE — lowest unmastered ancestor' });
  return { root, trace };
}
