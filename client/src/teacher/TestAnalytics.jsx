import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { go } from '../App.jsx';
import { Card, Badge, Bars, Skeleton } from '../components/ui.jsx';
import { TShell, tLogout } from './Overview.jsx';

const QUAD = { xMid: 1, yMid: 60 };

// Test analytics with cross-filtering: histogram band + question select filter the table.
export default function TeacherTest({ testId }) {
  const [tests, setTests] = useState(null);
  const [data, setData] = useState(null);
  const [band, setBand] = useState(null);
  const [qid, setQid] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    api.tests('?type=DEEP').then((t) => setTests(t.tests)).catch(() => {});
  }, []);
  useEffect(() => {
    setData(null);
    setBand(null);
    setQid(null);
    api.tAnalysis(testId).then(setData).catch(() => {});
  }, [testId]);

  const q = useMemo(() => (data?.questions ?? []).find((x) => x.question_id === (qid ?? data?.questions?.[0]?.question_id)), [data, qid]);
  const filtered = useMemo(() => {
    let rows = data?.students ?? [];
    if (band) rows = rows.filter((s) => s.acc * 100 >= band[0] && s.acc * 100 < band[1]);
    if (q) {
      // keep students whose answer to q is known (all) — band is the driver; question scopes the distractor panel
    }
    return rows;
  }, [data, band, q]);

  if (!data) return <TShell user={{ name: '' }} onLogout={tLogout}><Skeleton className="h-64" /></TShell>;

  const bands = Object.entries(data.distribution ?? {}).map(([b, n]) => ({ lo: Number(b), n }));
  const maxBand = Math.max(...bands.map((b) => b.n), 1);
  const clusters = buildClusters(data);

  const assign = async (studentIds, note) => {
    const r = await api.assign({ kind: 'PRACTICE', focus: {}, note, student_ids: studentIds });
    setToast(`Assigned to ${r.student_ids.length} students`);
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <TShell user={{ name: '' }} onLogout={tLogout}>
      <div className="flex flex-wrap items-center gap-2">
        <select value={testId} onChange={(e) => go(`/teacher/tests/${e.target.value}`)} aria-label="Test" className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm">
          {(tests ?? []).map((t) => <option key={t.test_id} value={t.test_id}>{t.title}</option>)}
        </select>
        {band && <button onClick={() => setBand(null)} className="rounded-full bg-sky-100 px-3 py-1 text-xs text-sky-900">Filter: score {band[0]}–{band[1]} ✕</button>}
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-stone-900">Score distribution</h2>
          <div className="mt-2 flex h-32 items-end gap-1" role="group" aria-label="Score bands">
            {bands.map((b) => (
              <button
                key={b.lo} onClick={() => setBand([b.lo, b.lo + 10])} title={`${b.lo}–${b.lo + 10}: ${b.n}`}
                className={`flex-1 rounded-t ${band?.[0] === b.lo ? 'bg-blue-700' : 'bg-blue-200 hover:bg-blue-300'}`}
                style={{ height: `${(b.n / maxBand) * 100}%`, minHeight: 8 }}
              />
            ))}
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-stone-900">What students chose</h2>
            <select value={q?.question_id ?? ''} onChange={(e) => setQid(e.target.value)} aria-label="Question" className="ml-auto rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs">
              {(data.questions ?? []).map((x, i) => <option key={x.question_id} value={x.question_id}>Q{i + 1}</option>)}
            </select>
          </div>
          {q && <Distractors q={q} onAssign={assign} />}
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-stone-900">Student × concept mastery</h2>
          <Heatmap data={data} onStudent={(id) => go(`/teacher/students/${id}`)} />
        </Card>
        <Card>
          <h2 className="font-semibold text-stone-900">Time vs accuracy</h2>
          <Scatter students={data.students} />
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {clusters.map((c) => (
          <Card key={c.tag} className={c.severe ? 'border-red-200 bg-red-50/40' : ''}>
            <Badge tone={c.severe ? 'red' : 'amber'}>{c.severe ? 'Class gap' : 'Pattern'}</Badge>
            <p className="mt-1 font-semibold text-stone-900">{c.title} · {c.students} students{c.topics ? ` · ${c.topics}` : ''}</p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => assign(c.studentIds, `Bridge set: ${c.title}`)} className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs">Assign bridge</button>
              <button onClick={() => go(`/teacher/lecture-planner?test=${testId}`)} className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs">Add to lecture plan</button>
            </div>
          </Card>
        ))}
      </section>

      <Card>
        <h2 className="font-semibold text-stone-900">Students{band ? ` · score ${band[0]}–${band[1]}` : ''} ({filtered.length})</h2>
        <ul className="mt-2 divide-y divide-stone-100 text-sm">
          {filtered.slice(0, 30).map((s) => (
            <li key={s.student_id}>
              <button onClick={() => go(`/teacher/students/${s.student_id}`)} className="flex w-full items-center gap-3 py-1.5 text-left">
                <span className="flex-1 text-stone-800">{s.name}</span>
                <span className="font-tabular text-stone-600">{Math.round(s.acc * 100)}%</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      {toast && <div className="no-print fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm text-white" role="status">{toast}</div>}
    </TShell>
  );
}

function Distractors({ q, onAssign }) {
  const rows = Object.entries(q.distractors ?? {}).map(([oid, d]) => ({ oid, ...d }));
  const total = rows.reduce((s, r) => s + r.count, 0) + (q ? 1 : 0);
  void total;
  const all = [...rows].sort((a, b) => b.count - a.count);
  const top = all[0];
  return (
    <div className="mt-2">
      <Bars rows={all.map((d, i) => ({ label: d.oid, value: d.count, display: `${d.count}`, color: i === 0 ? '#b45309' : '#93c5fd', title: `${d.count} students · tag ${d.tag}` }))} />
      <p className="mt-1 text-xs text-stone-500">Discrimination {q.discrimination} · tag: {top?.tag?.replace(/_/g, ' ')}</p>
      {top && (
        <button onClick={() => onAssign(top.students, `Bridge set for Q ${q.question_id}`)} className="mt-2 rounded-lg bg-stone-900 px-3 py-1.5 text-xs text-white">
          Assign bridge to these {top.students.length}
        </button>
      )}
    </div>
  );
}

function Heatmap({ data, onStudent }) {
  const concepts = data.heatmap?.concepts ?? [];
  const short = (id) => id.replace('kin_', '').replace('cur_', '').replace('opt_', '').replace('thm_', '').replace('lom_', '').replace('wep_', '').slice(0, 8);
  const color = (v) => (v == null ? '#f5f4f2' : v >= 0.75 ? '#bbf7d0' : v >= 0.55 ? '#fde68a' : '#fecaca');
  return (
    <div className="overflow-auto">
      <table className="border-collapse text-[10px]">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white p-1 text-left">Student</th>
            {concepts.map((c) => <th key={c} className="p-1 font-normal text-stone-500" title={c}>{short(c)}</th>)}
          </tr>
        </thead>
        <tbody>
          {(data.heatmap?.rows ?? []).slice(0, 30).map((r) => (
            <tr key={r.student_id}>
              <td className="sticky left-0 bg-white p-1 pr-2"><button onClick={() => onStudent(r.student_id)} className="underline">{r.name.split(' ')[0]}</button></td>
              {concepts.map((c) => (
                <td key={c} className="p-0.5" title={`${r.name} · ${c}: ${r.cells[c] == null ? 'no data' : Math.round(r.cells[c] * 100) + '%'}`}>
                  <span className="block h-4 w-7 rounded-sm border border-stone-200" style={{ background: color(r.cells[c]) }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Scatter({ students }) {
  const W = 300;
  const H = 190;
  const X = (r) => 10 + Math.min(2.2, r) * ((W - 20) / 2.2);
  const Y = (a) => H - 10 - a * (H - 20);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Time versus accuracy">
        <line x1={X(QUAD.xMid)} y1={0} x2={X(QUAD.xMid)} y2={H} stroke="#d6d0c7" strokeDasharray="4 4" />
        <line x1={0} y1={Y(QUAD.yMid / 100)} x2={W} y2={Y(QUAD.yMid / 100)} stroke="#d6d0c7" strokeDasharray="4 4" />
        <text x={8} y={16} fontSize={11} fill="#78716c">Rushing</text>
        <text x={W - 86} y={16} fontSize={11} fill="#78716c">Needs support</text>
        <text x={8} y={H - 8} fontSize={11} fill="#78716c">Fluent</text>
        <text x={W - 88} y={H - 8} fontSize={11} fill="#78716c">Careful, slow</text>
        {students.map((s) => (
          <a key={s.student_id} href={`#/teacher/students/${s.student_id}`} style={{ cursor: 'pointer' }}>
            <circle cx={X(s.avgRatio)} cy={Y(s.acc)} r={5.5} fill="#60a5fa" opacity={0.85}>
              <title>{`${s.name}: ${Math.round(s.acc * 100)}% — open drill-down`}</title>
            </circle>
          </a>
        ))}
      </svg>
    </div>
  );
}

function buildClusters(data) {
  const prev = data.tag_prevalence ?? {};
  const order = Object.entries(prev).sort((a, b) => b[1].students - a[1].students).slice(0, 4);
  return order.map(([tag, v]) => {
    // affected students: union of top distractor choosers across questions
    const ids = new Set();
    for (const q of data.questions ?? []) {
      for (const d of Object.values(q.distractors ?? {})) {
        if (d.tag === tag) d.students.forEach((s) => ids.add(s));
      }
    }
    return {
      tag,
      title: tag.replace(/_/g, ' '),
      students: v.students,
      topics: null,
      severe: (v.bySeverity?.SYSTEMIC ?? 0) >= 3,
      studentIds: [...ids],
    };
  });
}
