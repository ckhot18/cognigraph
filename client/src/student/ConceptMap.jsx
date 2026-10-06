import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { go } from '../App.jsx';

const STATE_META = {
  MASTERED: { label: 'Strong', dot: '#059669', fill: '#d1fae5' },
  IN_PROGRESS: { label: 'Building', dot: '#0284c7', fill: '#e0f2fe' },
  BLOCKED_NEED_ROOT: { label: 'Foundation to strengthen', dot: '#d97706', fill: '#fef3c7' },
  LOCKED: { label: 'Coming up', dot: '#a8a29e', fill: '#ffffff' },
  ACCELERATED: { label: 'Ready to stretch', dot: '#b45309', fill: '#fef9c3' },
};

// Horizontal concept chain with topic filter (26 nodes scroll horizontally).
export default function ConceptMap({ dag, states, onBridge, compact }) {
  const topics = dag?.topics ?? [];
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);
  const nodes = useMemo(() => {
    const list = dag?.concepts ?? [];
    return filter === 'all' ? list : list.filter((n) => n.topic_id === filter);
  }, [dag, filter]);
  const W = Math.max(560, nodes.length * 120);

  return (
    <div>
      {!compact && topics.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>All topics</FilterChip>
          {topics.filter((t) => t.topic_id !== 'foundations').map((t) => (
            <FilterChip key={t.topic_id} active={filter === t.topic_id} onClick={() => setFilter(t.topic_id)}>
              {t.title}
            </FilterChip>
          ))}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white p-3">
        <svg viewBox={`0 0 ${W} 120`} style={{ minWidth: 560, width: '100%' }} role="img" aria-label="Concept map">
          {nodes.map((n, i) => {
            const x = 60 + i * 120;
            const st = states?.[n.id]?.state ?? 'LOCKED';
            const meta = STATE_META[st] ?? STATE_META.LOCKED;
            const unknown = states?.[n.id]?.unknown;
            return (
              <g key={n.id}>
                {i > 0 && <line x1={x - 120 + 26} y1={48} x2={x - 26} y2={48} stroke="#d6d0c7" strokeWidth={2} />}
                <circle cx={x} cy={48} r={24} fill={unknown ? '#faf8f5' : meta.fill} stroke={meta.dot} strokeWidth={2.5} opacity={unknown ? 0.6 : 1}>
                  <title>{`${n.title} — ${unknown ? 'Not assessed yet' : meta.label}`}</title>
                </circle>
                <text x={x} y={100} textAnchor="middle" fontSize={11} fill="#57534e">
                  {n.title.length > 22 ? n.title.slice(0, 21) + '…' : n.title}
                </text>
                <circle cx={x} cy={48} r={24} fill="transparent" onClick={() => setOpen(n)} style={{ cursor: 'pointer' }} tabIndex={0} role="button" aria-label={n.title}
                  onKeyDown={(e) => { if (e.key === 'Enter') setOpen(n); }} />
              </g>
            );
          })}
        </svg>
      </div>
      {!compact && (
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-stone-600">
          {Object.entries({ MASTERED: 'Strong', IN_PROGRESS: 'Building', BLOCKED_NEED_ROOT: 'Foundation to strengthen', LOCKED: 'Coming up', ACCELERATED: 'Ready to stretch' }).map(([k, v]) => (
            <span key={k}><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: STATE_META[k].dot }} />{v}</span>
          ))}
        </div>
      )}
      {open && (
        <NodeDrawer node={open} state={states?.[open.id]} onClose={() => setOpen(null)} onBridge={onBridge} />
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick} aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 ${active ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white text-stone-600'}`}
    >
      {children}
    </button>
  );
}

function NodeDrawer({ node, state, onClose, onBridge }) {
  const meta = STATE_META[state?.state] ?? STATE_META.LOCKED;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={node.title}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-stone-900">{node.title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100">✕</button>
        </div>
        <p className="mt-1 text-sm text-stone-600">{node.description}</p>
        <p className="mt-2 text-sm"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: meta.dot }} />{state?.unknown ? 'Not assessed yet' : meta.label}</p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => onBridge({ concept_id: node.id })} className="rounded-xl bg-stone-900 px-4 py-2 text-sm text-white">Start bridge</button>
          <button onClick={() => go(`/student/learn/${node.id}`)} className="rounded-xl border border-stone-300 px-4 py-2 text-sm">Open lesson</button>
        </div>
      </div>
    </div>
  );
}

export function useDag() {
  const [dag, setDag] = useState(null);
  useEffect(() => {
    api.dag().then(setDag).catch(() => {});
  }, []);
  return dag;
}
