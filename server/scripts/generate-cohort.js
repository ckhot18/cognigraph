// Generates server/data/cohort_students.json — exactly 30 synthetic students.
// Seeded PRNG (mulberry32, seed 1729) so output is deterministic.
// Tune rule (spec 5.1): round(mean(overall_mastery)) === 68 — the generator
// nudges the last student of each group by ±1–3 until it holds.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'data', 'cohort_students.json');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(1729);
const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const f2 = (v) => Math.round(v * 100) / 100;

function m(lo, hi) {
  return f2(int(lo * 100, hi * 100) / 100);
}

const GROUPS = [
  {
    key: 'A',
    count: 12,
    tag: 'sign_convention_gravity',
    range: [45, 65],
    status: 'REMEDIATION_NEEDED',
    names: ['Alex M.', 'Priya K.', 'Marcus T.', 'Chen W.', 'Sam R.', 'Riley P.', 'Casey D.', 'Morgan F.', 'Jamie H.', 'Quinn B.', 'Avery S.', 'Dev P.'],
    nodes: () => ({
      scalar_variables: m(0.85, 0.98),
      coord_sign_conventions: m(0.3, 0.55),
      constant_accel_eqs: m(0.2, 0.48),
      implicit_boundary_conds: m(0.15, 0.45),
      vector_decomposition_2d: m(0.2, 0.48),
      variable_accel_calculus: m(0.05, 0.3),
    }),
    errors: () => ({ sign_convention_gravity: pick([3, 3, 4]) }),
  },
  {
    key: 'B',
    count: 6,
    tag: 'implicit_rest_state',
    range: [60, 75],
    status: 'REMEDIATION_NEEDED',
    names: ['Rohan S.', 'Sarah J.', 'Liam K.', 'Ava G.', 'Noah P.', 'Mia T.'],
    nodes: () => ({
      scalar_variables: m(0.88, 0.98),
      coord_sign_conventions: m(0.78, 0.92),
      constant_accel_eqs: m(0.65, 0.8),
      implicit_boundary_conds: m(0.35, 0.55),
      vector_decomposition_2d: m(0.65, 0.8),
      variable_accel_calculus: m(0.1, 0.3),
    }),
    errors: () => ({ implicit_rest_state: pick([2, 2, 3]) }),
  },
  {
    key: 'C',
    count: 4,
    tag: 'vector_vs_scalar',
    range: [62, 76],
    status: 'REMEDIATION_NEEDED',
    names: ['Ethan Z.', 'Lily C.', 'Omar V.', 'Zoe N.'],
    nodes: () => ({
      scalar_variables: m(0.88, 0.98),
      coord_sign_conventions: m(0.78, 0.92),
      constant_accel_eqs: m(0.7, 0.85),
      implicit_boundary_conds: m(0.65, 0.8),
      vector_decomposition_2d: m(0.35, 0.55),
      variable_accel_calculus: m(0.1, 0.3),
    }),
    errors: () => ({ vector_vs_scalar: pick([2, 2, 3]) }),
  },
  {
    key: 'D',
    count: 5,
    tag: null,
    range: [90, 98],
    status: 'ACCELERATED',
    names: ['Elena R.', 'David L.', 'Chloe W.', 'Ryan F.', 'Sophia H.'],
    nodes: () => ({
      scalar_variables: m(0.92, 0.99),
      coord_sign_conventions: m(0.9, 0.98),
      constant_accel_eqs: m(0.88, 0.97),
      implicit_boundary_conds: m(0.88, 0.97),
      vector_decomposition_2d: m(0.88, 0.97),
      variable_accel_calculus: m(0.5, 0.7),
    }),
    errors: () => ({}),
  },
  {
    key: 'E',
    count: 3,
    tag: null,
    range: [74, 84],
    status: 'ON_TRACK',
    names: ['Ben A.', 'Grace Y.', 'Leo Q.'],
    nodes: () => ({
      scalar_variables: m(0.85, 0.95),
      coord_sign_conventions: m(0.75, 0.88),
      constant_accel_eqs: m(0.7, 0.85),
      implicit_boundary_conds: m(0.7, 0.85),
      vector_decomposition_2d: m(0.7, 0.85),
      variable_accel_calculus: m(0.15, 0.35),
    }),
    errors: () => ({}),
  },
];

function generate() {
  const students = [];
  let n = 0;
  for (const g of GROUPS) {
    for (let i = 0; i < g.count; i++) {
      n += 1;
      students.push({
        student_id: `s${String(n).padStart(2, '0')}`,
        name: g.names[i],
        group: g.key,
        overall_mastery: int(g.range[0], g.range[1]),
        node_mastery: g.nodes(),
        error_history: g.errors(),
        status: g.status,
      });
    }
  }

  // Tune so round(mean) === 68 by nudging the last student of each group.
  const mean = () => students.reduce((s, x) => s + x.overall_mastery, 0) / students.length;
  const lastOf = (key) => {
    const idx = students.map((s, i) => (s.group === key ? i : -1)).filter((i) => i >= 0);
    return idx[idx.length - 1];
  };
  let guard = 0;
  while (Math.round(mean()) !== 68 && guard < 50) {
    guard += 1;
    const dir = Math.round(mean()) < 68 ? 1 : -1;
    // round-robin over group lasts, ±1 per pass (bounded to ±3 of authored range)
    for (const key of ['E', 'C', 'B', 'A', 'D']) {
      if (Math.round(mean()) === 68) break;
      const i = lastOf(key);
      const g = GROUPS.find((x) => x.key === key);
      const next = students[i].overall_mastery + dir;
      if (next >= g.range[0] - 3 && next <= g.range[1] + 3) students[i].overall_mastery = next;
    }
  }
  // Drop the internal helper before writing.
  return students.map(({ group, ...rest }) => rest);
}

const students = generate();
const avg = students.reduce((s, x) => s + x.overall_mastery, 0) / students.length;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ students }, null, 2) + '\n');
// eslint-disable-next-line no-console
console.log(`wrote ${students.length} students to ${OUT} (mean=${avg.toFixed(2)} -> ${Math.round(avg)})`);
