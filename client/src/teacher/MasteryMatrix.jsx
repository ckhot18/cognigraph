import { useMemo, useState } from 'react';

const CELL = {
  green: 'bg-emerald-500/70',
  yellow: 'bg-yellow-500/70',
  red: 'bg-red-500/70',
};

// 30 rows × 6 columns mastery matrix (spec 7.3). Sticky header, sortable.
export default function MasteryMatrix({ cohort }) {
  const [sortDesc, setSortDesc] = useState(true);
  const nodes = cohort.matrix?.nodes ?? [];
  const rows = useMemo(() => {
    const r = [...(cohort.matrix?.rows ?? [])];
    r.sort((a, b) => (sortDesc ? b.overall_mastery - a.overall_mastery : a.overall_mastery - b.overall_mastery));
    return r;
  }, [cohort, sortDesc]);

  const short = (id) => id.replace('scalar_variables', 'scalar').replace('coord_sign_conventions', 'sign').replace('constant_accel_eqs', 'const-acc').replace('implicit_boundary_conds', 'implicit').replace('vector_decomposition_2d', 'vector-2d').replace('variable_accel_calculus', 'var-calc');

  return (
    <section aria-label="Mastery matrix" className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur">
      <div className="mb-3 flex items-center gap-3">
        <h3 className="font-semibold">Mastery matrix</h3>
        <button
          type="button"
          onClick={() => setSortDesc((s) => !s)}
          className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          Sort: mastery {sortDesc ? '↓' : '↑'}
        </button>
      </div>
      <div className="max-h-96 overflow-auto rounded-lg border border-slate-800">
        <table className="w-full min-w-[640px] border-collapse text-xs">
          <thead className="sticky top-0 bg-slate-950">
            <tr>
              <th className="sticky left-0 bg-slate-950 p-2 text-left font-medium text-slate-300">Student</th>
              <th className="p-2 text-right font-medium text-slate-300">Avg</th>
              {nodes.map((n) => (
                <th key={n} className="p-2 text-center font-medium text-slate-300" title={n}>{short(n)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.student_id} className="border-t border-slate-800/60">
                <td className="sticky left-0 bg-slate-950 p-2 text-slate-200">{r.name}</td>
                <td className="p-2 text-right text-slate-300">{r.overall_mastery}%</td>
                {nodes.map((n) => (
                  <td key={n} className="p-1.5 text-center" title={`${r.name} · ${n}: ${r.cells[n]}`}>
                    <span className={`inline-block h-4 w-8 rounded ${CELL[r.cells[n]] ?? 'bg-slate-700'}`} aria-label={`${n} ${r.cells[n]}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
