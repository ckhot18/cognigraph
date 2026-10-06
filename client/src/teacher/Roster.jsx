import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { go } from '../App.jsx';
import { Card, Badge, Skeleton } from '../components/ui.jsx';
import { TShell, tLogout } from './Overview.jsx';

export default function TeacherRoster() {
  const [rows, setRows] = useState(null);
  const [seg, setSeg] = useState('all');
  const [desc, setDesc] = useState(true);
  useEffect(() => {
    api.tStudents().then((r) => setRows(r.students)).catch(() => {});
  }, []);
  if (!rows) return <TShell user={{ name: '' }} onLogout={tLogout}><Skeleton className="h-64" /></TShell>;
  const segs = ['all', ...new Set(rows.map((r) => r.segment))];
  const shown = rows
    .filter((r) => seg === 'all' || r.segment === seg)
    .sort((a, b) => (desc ? b.overall - a.overall : a.overall - b.overall));

  return (
    <TShell user={{ name: '' }} onLogout={tLogout}>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold text-stone-900">Roster</h1>
        <select value={seg} onChange={(e) => setSeg(e.target.value)} aria-label="Segment filter" className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm">
          {segs.map((s) => <option key={s} value={s}>{s === 'all' ? 'All segments' : s.replace(/_/g, ' ')}</option>)}
        </select>
        <button onClick={() => setDesc((d) => !d)} className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm">Overall {desc ? '↓' : '↑'}</button>
      </div>
      <Card>
        <ul className="divide-y divide-stone-100">
          {shown.map((r) => (
            <li key={r.student_id}>
              <button onClick={() => go(`/teacher/students/${r.student_id}`)} className="flex w-full items-center gap-3 py-2 text-left text-sm">
                <span className="font-medium text-stone-800">{r.name}</span>
                <Badge tone={r.segment === 'ACCELERATE' ? 'green' : r.segment === 'NEEDS_STRONG_SUPPORT' ? 'red' : 'amber'}>{r.segment.replace(/_/g, ' ')}</Badge>
                <span className="ml-auto font-tabular text-stone-600">{r.overall.toFixed(0)}% · {r.trend.toLowerCase()}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </TShell>
  );
}
