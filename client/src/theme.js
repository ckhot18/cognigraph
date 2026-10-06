// Single source of truth for state -> color and severity -> badge (spec 7.1).

export const NODE_STATE_STYLES = {
  LOCKED: { dot: 'bg-slate-600', ring: 'border-slate-700', text: 'text-slate-400', icon: '🔒' },
  IN_PROGRESS: { dot: 'bg-sky-400', ring: 'border-sky-400/60', text: 'text-sky-300', icon: '◐' },
  BLOCKED_NEED_ROOT: { dot: 'bg-red-500', ring: 'border-red-500', text: 'text-red-300', icon: '⚠' },
  MASTERED: { dot: 'bg-emerald-500', ring: 'border-emerald-500/60', text: 'text-emerald-300', icon: '✓' },
  ACCELERATED: { dot: 'bg-amber-400', ring: 'border-amber-300', text: 'text-amber-300', icon: '★' },
};

export const BADGES = {
  CRITICAL_GAP: '🔴 CRITICAL GAP',
  PARTIAL_FRICTION: '🟡 PARTIAL FRICTION',
  MASTERED: '🟢 MASTERED',
  ACCELERATED: '🌟 ACCELERATED',
};

export const SEVERITY_LABELS = {
  SLIP: 'Slip',
  PARTIAL_MENTAL_MODEL: 'Partial Mental Model',
  SYSTEMIC_MISCONCEPTION: 'Systemic Misconception',
  NONE: 'No gap',
};
