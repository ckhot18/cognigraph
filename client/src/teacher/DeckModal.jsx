// 5-slide remediation deck preview (P1, spec 7.3).
export default function DeckModal({ deck, onClose }) {
  if (!deck) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Remediation deck">
      <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-xl border border-slate-700 bg-slate-900 p-5">
        <h3 className="font-semibold">10-Min Sign Rules Remediation Deck</h3>
        <ol className="mt-3 space-y-3">
          {(deck.slides ?? []).map((s) => (
            <li key={s.n} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-sm font-semibold text-slate-100">Slide {s.n}: {s.title}</p>
              <ul className="mt-1 list-disc pl-5 text-xs text-slate-300">
                {(s.points ?? []).map((pt, i) => <li key={i}>{pt}</li>)}
              </ul>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="mt-4 rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        >
          Close
        </button>
      </div>
    </div>
  );
}
