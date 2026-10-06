import { useEffect } from 'react';

// Preset selector + demo reset + keyboard shortcuts 1–4 (spec 7.2).
export default function PresetBar({ presets, selectedId, onSelect, onReset, resetting }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const n = Number(e.key);
      if (n >= 1 && n <= presets.length) {
        const p = presets[n - 1];
        if (p) onSelect(p.preset_id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presets, onSelect]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="preset-select" className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Demo preset
      </label>
      <select
        id="preset-select"
        value={selectedId ?? ''}
        onChange={(e) => onSelect(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        {presets.map((p, i) => (
          <option key={p.preset_id} value={p.preset_id}>
            {i + 1}. {p.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onReset}
        disabled={resetting}
        className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-300 hover:border-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50"
      >
        {resetting ? 'Resetting…' : 'Reset demo'}
      </button>
    </div>
  );
}
