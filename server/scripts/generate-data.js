// Synthetic cohort generator (V2 §5). Seeded mulberry32(20261006) → deterministic.
// Writes students.json, results.json, responses.json + generator-expectations.json
// (expected segments — for the recovery TEST ONLY; analytics must never read it).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TOPICS = ['kinematics', 'laws_of_motion', 'work_energy_power', 'current_electricity', 'optics', 'thermodynamics'];

// id, name, archetype, base per topic, boosts, time mu/sigma, change rate, expected segment
const ROSTER = [
  [1, 'Aarav Sharma', 'topper', null, null, 0.7, 0.25, 0.05, 'ACCELERATE'],
  [2, 'Ananya Iyer', 'topper', null, null, 0.7, 0.25, 0.05, 'ACCELERATE'],
  [3, 'Rohan Patil', 'struggling', null, null, 1.6, 0.35, 0.12, 'NEEDS_STRONG_SUPPORT'],
  [4, 'Kavya Nair', 'struggling', null, null, 1.6, 0.35, 0.12, 'NEEDS_STRONG_SUPPORT'],
  [5, 'Arjun Deshmukh', 'sign', null,       { sign_convention: 20 }, 1.0, 0.3, 0.08, 'SIGN_CONVENTION_GAP'],
  [6, 'Priya Kulkarni', 'sign', null,       { sign_convention: 20 }, 1.0, 0.3, 0.08, 'SIGN_CONVENTION_GAP'],
  [7, 'Vihaan Joshi', 'sign', null,       { sign_convention: 20 }, 1.0, 0.3, 0.08, 'SIGN_CONVENTION_GAP'],
  [8, 'Isha Mehta', 'sign', null,       { sign_convention: 20 }, 1.0, 0.3, 0.08, 'SIGN_CONVENTION_GAP'],
  [9, 'Siddharth Rao', 'calc', null, { arithmetic_slip: 6, unit_conversion: 6, omitted_term: 6 }, 0.6, 0.3, 0.06, 'CALCULATION_HABITS'],
  [10, 'Meera Pawar', 'calc', null, { arithmetic_slip: 6, unit_conversion: 6, omitted_term: 6 }, 0.6, 0.3, 0.06, 'CALCULATION_HABITS'],
  [11, 'Aditya Jadhav', 'calc', null, { arithmetic_slip: 6, unit_conversion: 6, omitted_term: 6 }, 0.6, 0.3, 0.06, 'CALCULATION_HABITS'],
  [12, 'Sneha Gokhale', 'calc', null, { arithmetic_slip: 6, unit_conversion: 6, omitted_term: 6 }, 0.6, 0.3, 0.06, 'CALCULATION_HABITS'],
  [13, 'Kabir Singh', 'edge', null,       { implicit_condition: 20 }, 1.0, 0.3, 0.08, 'EDGE_CASE_GAP'],
  [14, 'Diya Reddy', 'edge', null,       { implicit_condition: 20 }, 1.0, 0.3, 0.08, 'EDGE_CASE_GAP'],
  [15, 'Yash More', 'edge', null,       { implicit_condition: 20 }, 1.0, 0.3, 0.08, 'EDGE_CASE_GAP'],
  [16, 'Riya Chavan', 'lag_elec', null, { formula_misapplication: 4, unit_conversion: 4 }, 1.0, 0.3, 0.08, 'TOPIC_LAG:current_electricity'],
  [17, 'Neil DSouza', 'lag_elec', null, { formula_misapplication: 4, unit_conversion: 4 }, 1.0, 0.3, 0.08, 'TOPIC_LAG:current_electricity'],
  [18, 'Tanvi Shinde', 'lag_elec', null, { formula_misapplication: 4, unit_conversion: 4 }, 1.0, 0.3, 0.08, 'TOPIC_LAG:current_electricity'],
  [19, 'Om Kamble', 'lag_thm', null, null, 1.0, 0.3, 0.08, 'TOPIC_LAG:thermodynamics'],
  [20, 'Sana Sheikh', 'lag_thm', null, null, 1.0, 0.3, 0.08, 'TOPIC_LAG:thermodynamics'],
  [21, 'Harsh Gupta', 'lag_thm', null, null, 1.0, 0.3, 0.08, 'TOPIC_LAG:thermodynamics'],
  [22, 'Pooja Bhosale', 'lag_opt', null, { formula_misapplication: 4 }, 1.0, 0.3, 0.08, 'TOPIC_LAG:optics'],
  [23, 'Dev Malhotra', 'lag_opt', null, { formula_misapplication: 4 }, 1.0, 0.3, 0.08, 'TOPIC_LAG:optics'],
  [24, 'Aisha Khan', 'lag_opt', null, { formula_misapplication: 4 }, 1.0, 0.3, 0.08, 'TOPIC_LAG:optics'],
  [25, 'Karan Thakur', 'improving', null, null, 1.0, 0.3, 0.1, 'IMPROVING'],
  [26, 'Nisha Menon', 'improving', null, null, 1.0, 0.3, 0.1, 'IMPROVING'],
  [27, 'Pranav Kale', 'declining', null, null, 1.0, 0.3, 0.14, 'DECLINING'],
  [28, 'Rhea Fernandes', 'declining', null, null, 1.0, 0.3, 0.14, 'DECLINING'],
  [29, 'Atharv Salunkhe', 'guesser', null, null, 0.25, 0.3, 0.02, 'GUESSING_PATTERN'],
  [30, 'Zoya Ansari', 'guesser', null, null, 0.25, 0.3, 0.02, 'GUESSING_PATTERN'],
];

function baseFor(arch, topic, testIdx, nTests) {
  switch (arch) {
    case 'topper': return 0.98;
    case 'struggling': return 0.27;
    case 'sign': return 0.75;
    case 'calc': return 0.8;
    case 'edge': return 0.6;
    case 'lag_elec': return topic === 'current_electricity' ? 0.30 : 0.84;
    case 'lag_thm': return topic === 'thermodynamics' ? 0.30 : 0.84;
    case 'lag_opt': return topic === 'optics' ? 0.30 : 0.84;
    case 'improving': return 0.62 + (0.9 - 0.62) * (testIdx / (nTests - 1));
    case 'declining': return 0.86 - (0.86 - 0.63) * (testIdx / (nTests - 1));
    case 'guesser': return 0.25;
    default: return 0.7;
  }
}

export function generateAll(pack) {
  const rand = mulberry32(20261006);
  const gauss = () => {
    const u = Math.max(rand(), 1e-9);
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const qById = new Map(pack.questions.map((q) => [q.id, q]));
  const deepTests = pack.tests.filter((t) => t.type === 'DEEP').sort((a, b) => a.date.localeCompare(b.date));
  const allTests = [...pack.tests].sort((a, b) => a.date.localeCompare(b.date));

  // Secondary weak topic for 40% of mid students (deterministic draw).
  const secondaryWeak = {};
  for (const [id, , arch] of ROSTER) {
    if (['topper', 'struggling', 'guesser'].includes(arch)) continue;
    if (rand() < 0.4) {
      const lagTopic = { lag_elec: 'current_electricity', lag_thm: 'thermodynamics', lag_opt: 'optics' }[arch];
      const pool = TOPICS.filter((t) => t !== lagTopic);
      secondaryWeak[id] = pool[Math.floor(rand() * pool.length)];
    }
  }

  const students = ROSTER.map(([id, name]) => ({
    student_id: String(id), name, roll_no: String(id), class_id: '12-A', avatar_seed: id,
  }));
  const responses = [];
  const results = [];
  const perStudentScore = {};

  for (const [id, , arch, , boosts, mu, sigma, changeRate] of ROSTER) {
    const sid = String(id);
    perStudentScore[sid] = [];
    deepTests.forEach((t, ti) => {
      let correct = 0;
      let timeTotal = 0;
      for (const qid of t.question_ids) {
        const q = qById.get(qid);
        let base = baseFor(arch, t.topic_id, ti, deepTests.length);
        if (secondaryWeak[id] === t.topic_id) base -= 0.12;
        const p = Math.min(0.98, Math.max(0.02, base - 0.07 * (q.difficulty - 1) + gauss() * 0.05));
        const hit = rand() < p;
        let chosen;
        if (hit) {
          chosen = q.correct_option_id;
        } else if (arch === 'guesser') {
          const opts = q.options.map((o) => o.id);
          chosen = opts[Math.floor(rand() * opts.length)];
        } else {
          const wrong = q.options.map((o) => o.id).filter((oid) => oid !== q.correct_option_id);
          const weights = wrong.map((oid) => {
            const tag = q.payloads[oid].tag;
            return (boosts && boosts[tag]) || 1;
          });
          const sum = weights.reduce((a, b) => a + b, 0);
          let r = rand() * sum;
          chosen = wrong[wrong.length - 1];
          for (let i = 0; i < wrong.length; i++) {
            r -= weights[i];
            if (r <= 0) { chosen = wrong[i]; break; }
          }
        }
        const timeSec = arch === 'topper' ? Math.max(3, Math.round(q.expected_time_sec * 0.7 * Math.exp(gauss() * 0.25)))
          : arch === 'guesser' ? Math.max(2, Math.round(q.expected_time_sec * 0.25 * Math.exp(gauss() * 0.3)))
          : arch === 'struggling' ? Math.round(q.expected_time_sec * 1.6 * Math.exp(gauss() * 0.3))
          : Math.max(3, Math.round(q.expected_time_sec * mu * Math.exp(gauss() * sigma)));
        timeTotal += timeSec;
        if (chosen === q.correct_option_id) correct += 1;
        responses.push({
          student_id: sid, test_id: t.test_id, question_id: qid,
          chosen_option_id: chosen, correct_option_id: q.correct_option_id,
          is_correct: chosen === q.correct_option_id, time_sec: timeSec,
          changed_answer: rand() < changeRate,
        });
      }
      results.push({ student_id: sid, test_id: t.test_id, score: correct, max_score: 10, time_total_sec: timeTotal });
      perStudentScore[sid].push({ date: t.date, pct: (correct / 10) * 100 });
    });
  }

  // Legacy summary scores.
  const legacyBase = { topper: 92, struggling: 30, sign: 78, calc: 76, edge: 73, lag_elec: 72, lag_thm: 72, lag_opt: 72, improving: 68, declining: 72, guesser: 32 };
  const subjOff = { Physics: 0, Mathematics: -2, Chemistry: 1 };
  for (const [id, , arch] of ROSTER) {
    const sid = String(id);
    for (const t of allTests.filter((x) => x.type === 'SUMMARY')) {
      let base = legacyBase[arch] + (subjOff[t.subject] ?? 0) + gauss() * 4;
      if (arch === 'improving') base += (t.date.localeCompare('2026-09-01') >= 0 ? 12 : -12);
      if (arch === 'declining') base += (t.date.localeCompare('2026-09-01') >= 0 ? -12 : 12);
      const score = Math.max(0, Math.min(t.max_score, Math.round((base / 100) * t.max_score)));
      results.push({ student_id: sid, test_id: t.test_id, score, max_score: t.max_score, time_total_sec: null });
      perStudentScore[sid].push({ date: t.date, pct: (score / t.max_score) * 100 });
    }
  }

  const expectations = {};
  for (const [id, , , , , , , , exp] of ROSTER) expectations[String(id)] = exp;
  return { students, results, responses, expectations };
}

// CLI: node server/scripts/generate-data.js
if (process.argv[1] && process.argv[1].endsWith('generate-data.js')) {
  const { loadPack } = await import('../engine/validatePack.js');
  const pack = loadPack();
  const { students, results, responses, expectations } = generateAll(pack);
  const w = (f, o) => fs.writeFileSync(path.join(DATA, f), JSON.stringify(o, null, 1) + '\n');
  w('students.json', { students });
  w('results.json', { results });
  w('responses.json', { responses });
  w('generator-expectations.json', { expectations });
  console.log(`wrote ${students.length} students, ${results.length} results, ${responses.length} responses`);
}
