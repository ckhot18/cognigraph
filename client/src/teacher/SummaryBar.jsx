// Cohort summary strip (spec 7.3): totals, average, critical gaps, distribution bar.
export default function SummaryBar({ cohort }) {
  const d = cohort.mastery_distribution ?? {};
  const total = cohort.total_students || 1;
  const segs = [
    { label: 'Remediation', count: d.REMEDIATION_NEEDED ?? 0, cls: 'bg-red-500' },
    { label: 'On track', count: d.ON_TRACK ?? 0, cls: 'bg-yellow-500' },
    { label: 'Accelerated', count: d.ACCELERATED ?? 0, cls: 'bg-amber-400' },
  ];
  return (
    <section aria-label="Cohort summary" className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur">
      <div className="flex flex-wrap gap-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Total students</p>
          <p className="text-2xl font-bold">{cohort.total_students}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Class average</p>
          <p className="text-2xl font-bold">{cohort.class_average_mastery}%</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Active critical gaps</p>
          <p className="text-2xl font-bold text-red-300">{cohort.active_critical_gaps?.label}</p>
        </div>
      </div>
      <div className="mt-4" aria-label="Mastery distribution">
        <div className="flex h-3 overflow-hidden rounded-full bg-slate-800">
          {segs.map((s) => (
            <div key={s.label} className={s.cls} style={{ width: `${(s.count / total) * 100}%` }} title={`${s.label}: ${s.count}`} />
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-4 text-xs text-slate-400">
          {segs.map((s) => (
            <span key={s.label}>{s.label}: {s.count}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
