import { useState } from 'react';
import StudentHub from './student/StudentHub.jsx';
import TeacherCenter from './teacher/TeacherCenter.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';

// App shell: mode switcher between Student Hub (Phase 4) and Teacher Center (Phase 5).
const MODES = [
  { id: 'student', label: 'Student Diagnostic Hub' },
  { id: 'teacher', label: 'Teacher Command Center' },
];

export default function App() {
  const [mode, setMode] = useState('student');
  const [studentPreset, setStudentPreset] = useState('case1');

  const openStudent = (presetId) => {
    setStudentPreset(presetId);
    setMode('student');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-indigo-500 focus:px-3 focus:py-1 focus:text-white">
        Skip to content
      </a>
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
          <div>
            <p className="text-lg font-semibold tracking-tight">
              CogniGraph <span className="text-indigo-400">AI</span>
            </p>
            <p className="text-xs text-slate-400">
              Deterministic misconception diagnostics · synthetic demo data
            </p>
          </div>
          <nav className="ml-auto flex gap-2" aria-label="Mode">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                aria-pressed={mode === m.id}
                className={`rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                  mode === m.id
                    ? 'border-indigo-400 bg-indigo-500/20 text-white'
                    : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700'
                }`}
              >
                {m.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-8">
        {mode === 'student' ? (
          <ErrorBoundary name="the Student Hub">
            <StudentHub key={studentPreset} initialPresetId={studentPreset} onExternalPreset={setStudentPreset} />
          </ErrorBoundary>
        ) : (
          <ErrorBoundary name="the Teacher Center">
            <TeacherCenter onOpenStudent={openStudent} />
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}
