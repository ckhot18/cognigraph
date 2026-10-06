import { BADGES } from '../theme.js';

// Overall mastery %, session score, badge (spec 7.2 item 1).
export default function MasteryHeader({ report }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Overall mastery</p>
        <p className="text-2xl font-bold">{report.overall_mastery}%</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Session score</p>
        <p className="text-2xl font-bold">{report.session_score}%</p>
      </div>
      <span className="ml-auto rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-sm font-semibold">
        {BADGES[report.badge] ?? report.badge}
      </span>
    </div>
  );
}
