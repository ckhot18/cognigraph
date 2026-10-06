import { Component } from 'react';

// Shared primitives: warm cards, stats, badges, tabs, modal, toast, charts (hand SVG).

export function Card({ className = '', children, ...rest }) {
  return (
    <div className={`card p-5 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function Stat({ label, value, sub }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
      <p className="font-tabular mt-1 text-3xl font-bold text-stone-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-stone-500">{sub}</p>}
    </div>
  );
}

const BADGE = {
  amber: 'bg-amber-100 text-amber-900',
  sky: 'bg-sky-100 text-sky-900',
  green: 'bg-emerald-100 text-emerald-900',
  gold: 'bg-yellow-100 text-yellow-900',
  slate: 'bg-stone-100 text-stone-700',
  red: 'bg-red-100 text-red-800',
};

export function Badge({ tone = 'slate', children, className = '' }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE[tone] ?? BADGE.slate} ${className}`}>
      {children}
    </span>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 border-b border-stone-200" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
            value === t.id ? 'border-stone-900 font-semibold text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function SegmentedControl({ options, value, onChange, label }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={`rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 ${
            value === o.id ? 'bg-white text-stone-900 shadow' : 'text-stone-500'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-stone-900">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`skeleton rounded-lg ${className}`} aria-label="Loading" />;
}

export function EmptyState({ title, hint }) {
  return (
    <div className="card p-8 text-center">
      <p className="font-medium text-stone-800">{title}</p>
      {hint && <p className="mt-1 text-sm text-stone-500">{hint}</p>}
    </div>
  );
}

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { issue: null };
  }
  static getDerivedStateFromError(e) {
    return { issue: e };
  }
  render() {
    if (this.state.issue) {
      return (
        <div className="card border-amber-300 bg-amber-50 p-6 text-sm text-amber-900" role="alert">
          <p className="font-semibold">This view ran into a snag.</p>
          <button onClick={() => this.setState({ issue: null })} className="mt-3 rounded-lg bg-stone-900 px-3 py-1.5 text-white">Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function ProgressRing({ value, size = 64, tone = 'strong' }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const colors = { strong: '#059669', bridge: '#d97706', build: '#0284c7', slate: '#78716c' };
  return (
    <svg width={size} height={size} role="img" aria-label={`${value} percent`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e7e2da" strokeWidth={7} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors[tone] ?? colors.strong} strokeWidth={7}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * Math.min(100, value)) / 100}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size / 3.4} fontWeight={700} fill="#1c1917">{value}</text>
    </svg>
  );
}

export function LineChart({ points, width = 320, height = 120, hollow = [], links = [] }) {
  if (points.length < 2) return <p className="text-sm text-stone-500">Not enough points yet.</p>;
  const max = Math.max(...points, 100);
  const min = Math.min(...points, 0);
  const X = (i) => 8 + (i * (width - 16)) / (points.length - 1);
  const Y = (v) => height - 8 - ((v - min) / (max - min || 1)) * (height - 16);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${Y(p).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Progress line">
      <path d={d} fill="none" stroke="#1e40af" strokeWidth={2.5} strokeLinejoin="round" />
      {points.map((p, i) => (
        <a key={i} href={links[i] ?? undefined} style={links[i] ? { cursor: 'pointer' } : undefined}>
          <circle cx={X(i)} cy={Y(p)} r={6} fill={hollow[i] ? '#fff' : '#1e40af'} stroke="#1e40af" strokeWidth={2.5}>
            <title>{`${p}%${links[i] ? ' — open' : ''}`}</title>
          </circle>
        </a>
      ))}
    </svg>
  );
}

export function Donut({ slices, size = 120 }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - 20) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} role="img" aria-label="Mix chart">
        {slices.map((s, i) => {
          const frac = s.value / total;
          const el = (
            <circle
              key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={16}
              strokeDasharray={`${(frac * c).toFixed(1)} ${c.toFixed(1)}`}
              strokeDashoffset={(-acc * c).toFixed(1)}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            >
              <title>{`${s.label}: ${s.value}`}</title>
            </circle>
          );
          acc += frac;
          return el;
        })}
      </svg>
      <ul className="space-y-1 text-xs text-stone-600">
        {slices.map((s, i) => (
          <li key={i}><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.label} {Math.round((s.value / total) * 100)}%</li>
        ))}
      </ul>
    </div>
  );
}

export function Bars({ rows, max }) {
  const m = max ?? Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <button
          key={i} onClick={r.onClick} disabled={!r.onClick} title={r.title}
          className={`block w-full text-left focus:outline-none ${r.onClick ? 'cursor-pointer focus-visible:ring-2 focus-visible:ring-stone-900' : ''}`}
        >
          <div className="flex items-center gap-2 text-xs">
            <span className="w-28 truncate text-stone-600">{r.label}</span>
            <span className="h-4 flex-1 overflow-hidden rounded bg-stone-100">
              <span className="block h-full rounded" style={{ width: `${(r.value / m) * 100}%`, background: r.color ?? '#1e40af' }} />
            </span>
            <span className="font-tabular w-10 text-right text-stone-700">{r.display ?? r.value}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

export function Toast({ toast, onUndo }) {
  if (!toast) return null;
  return (
    <div className="no-print fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm text-white shadow-xl" role="status">
      {toast.message}
      {toast.undo && (
        <button onClick={onUndo} className="ml-3 underline">Undo</button>
      )}
    </div>
  );
}
