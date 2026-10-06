import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { go } from '../App.jsx';
import { Card, Stat, Badge, Bars, LineChart, Skeleton, EmptyState } from '../components/ui.jsx';

export function TShell({ user, onLogout, children }) {
  return (
    <div className="min-h-screen bg-[#f4f2ee]">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-[#f4f2ee]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <button onClick={() => go('/teacher')} className="font-bold text-stone-900">CogniGraph · Teacher</button>
          <nav className="hidden gap-4 text-sm text-stone-600 sm:flex" aria-label="Teacher">
            <button onClick={() => go('/teacher')} className="hover:text-stone-900">Overview</button>
            <button onClick={() => go('/teacher/students')} className="hover:text-stone-900">Roster</button>
            <button onClick={() => go('/teacher/lecture-planner')} className="hover:text-stone-900">Lecture planner</button>
          </nav>
          <span className="ml-auto rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Synthetic demo data</span>
          <span className="text-sm text-stone-600">{user?.name}</span>
          <button onClick={onLogout} className="no-print rounded-lg border border-stone-300 px-3 py-1.5 text-sm">Log out</button>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl space-y-4 px-4 py-6">{children}</main>
    </div>
  );
}

export async function tLogout() {
  await api.logout();
  go('/login');
}

export default function TeacherOverview({ user, onLogout }) {
  const [data, setData] = useState(null);
  const [asgs, setAsgs] = useState(null);
  useEffect(() => {
    Promise.all([api.tOverview(), api.assignments()]).then(([o, a]) => { setData(o); setAsgs(a.assignments); }).catch(() => {});
  }, []);
  if (!data) return <TShell user={user} onLogout={onLogout}><Skeleton className="h-48" /></TShell>;
  if (!data.total_students) return <TShell user={user} onLogout={onLogout}><EmptyState title="Overview is taking a moment" hint="Reload to try again." /></TShell>;

  const segRows = Object.entries(data.segments ?? {}).map(([label, value]) => ({
    label: label.replace(/_/g, ' '), value,
    color: label.includes('SUPPORT') ? '#b91c1c' : label.includes('ACCELERATE') ? '#059669' : label.includes('LAG') ? '#1e40af' : '#b45309',
  }));
  const trendPts = (data.trend ?? []).map((t) => t.avg ?? 0);
  const done = asgs?.length ?? 0;

  return (
    <TShell user={user} onLogout={onLogout}>
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><Stat label="Students" value={data.total_students} /></Card>
        <Card><Stat label="Class average" value={`${data.class_average}%`} /></Card>
        <Card><Stat label="Bridge assignments" value={done} sub="created this session" /></Card>
        <Card><Stat label="Top class gap" value={data.top_gaps?.[0]?.tag.replace(/_/g, ' ') ?? '—'} sub={data.top_gaps?.[0] ? `${data.top_gaps[0].students} students` : ''} /></Card>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-stone-900">Segments</h2>
          <div className="mt-2"><Bars rows={segRows} /></div>
        </Card>
        <Card>
          <h2 className="font-semibold text-stone-900">Class trend by test</h2>
          <LineChart points={trendPts} />
        </Card>
      </section>
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <h2 className="font-semibold text-stone-900">Needs attention</h2>
            <p className="text-sm text-stone-600">{data.needs_attention.map((s) => s.name).slice(0, 6).join(' · ') || 'No urgent flags.'}</p>
          </div>
          <button onClick={() => go('/teacher/lecture-planner')} className="no-print ml-auto rounded-xl bg-stone-900 px-4 py-2 text-sm text-white">Plan the next revision lecture</button>
        </div>
      </Card>
    </TShell>
  );
}
