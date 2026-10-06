import { useState } from 'react';
import { api, store, bustAll } from '../api.js';
import { SegmentedControl, Card } from '../components/ui.jsx';
import { go } from '../App.jsx';

const SHORTCUTS = [
  { role: 'student', id: '1', label: 'Student 1 · top performer' },
  { role: 'student', id: '5', label: 'Student 5 · sign-convention gaps' },
  { role: 'student', id: '10', label: 'Student 10 · calculation habits' },
  { role: 'student', id: '17', label: 'Student 17 · electricity gaps' },
  { role: 'student', id: '29', label: 'Student 29 · fast guesser' },
  { role: 'teacher', id: '1', label: 'Teacher' },
];

export default function Login({ onLogin }) {
  const params = new URLSearchParams(window.location.search);
  const [role, setRole] = useState('student');
  const [id, setId] = useState('1');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState(null);
  const [open, setOpen] = useState(params.get('demo') === '1');

  const submit = async (r, i, pw) => {
    setBusy(true);
    setIssue(null);
    try {
      bustAll();
      const { token, user } = await api.login(r, i, pw);
      store.token = token;
      store.user = user;
      onLogin(user);
    } catch (e) {
      setIssue('Those details did not match. Check the ID and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-center text-2xl font-bold text-stone-900">Welcome back</h1>
      <div className="mt-4">
        <SegmentedControl
          label="Role"
          options={[{ id: 'student', label: 'Student' }, { id: 'teacher', label: 'Teacher' }]}
          value={role}
          onChange={(r) => { setRole(r); setId(r === 'teacher' ? '1' : id); }}
        />
      </div>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => { e.preventDefault(); submit(role, id, password); }}
      >
        <div>
          <label htmlFor="login-id" className="text-sm text-stone-600">ID</label>
          <input
            id="login-id" value={id} onChange={(e) => setId(e.target.value)} inputMode="numeric"
            className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
          />
        </div>
        <div>
          <label htmlFor="login-pw" className="text-sm text-stone-600">Password</label>
          <input
            id="login-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••" autoComplete="current-password"
            className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
          />
        </div>
        {issue && <p className="text-sm text-amber-800" role="alert">{issue}</p>}
        <button
          type="submit" disabled={busy}
          className="w-full rounded-xl bg-stone-900 px-4 py-2.5 font-medium text-white hover:bg-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 disabled:opacity-60"
        >
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="mt-3 text-center text-xs text-stone-500">Demo: IDs 1–30, password 123</p>
      <div className="mt-4">
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="text-sm font-medium text-stone-700 underline">
          Demo shortcuts {open ? '▾' : '▸'}
        </button>
        {open && (
          <Card className="mt-2 space-y-1.5 bg-stone-50 p-4">
            {SHORTCUTS.map((s) => (
              <button
                key={s.label}
                disabled={busy}
                onClick={() => submit(s.role, s.id, '123')}
                className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-stone-700 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
              >
                {s.label}
              </button>
            ))}
          </Card>
        )}
      </div>
    </main>
  );
}
