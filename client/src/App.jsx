import { useCallback, useEffect, useState } from 'react';
import { store } from './api.js';
import { ErrorBoundary } from './components/ui.jsx';
import Landing from './landing/Landing.jsx';
import Login from './auth/Login.jsx';
import StudentHome from './student/Home.jsx';
import StudentTest from './student/TestPage.jsx';
import Practice from './student/Practice.jsx';
import Learn from './student/Learn.jsx';
import TeacherOverview from './teacher/Overview.jsx';
import TeacherTest from './teacher/TestAnalytics.jsx';
import TeacherRoster from './teacher/Roster.jsx';
import TeacherStudent from './teacher/DrillDown.jsx';
import LecturePlanner from './teacher/LecturePlanner.jsx';

function parseHash() {
  const h = window.location.hash.replace(/^#/, '') || '/';
  const [_, ...parts] = h.split('/');
  return { path: '/' + parts.join('/'), parts };
}

function useRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function go(path) {
  window.location.hash = '#' + path;
}

export default function App() {
  const route = useRoute();
  const [user, setUser] = useState(store.user);
  const authed = !!store.token && !!user;

  const logout = useCallback(async () => {
    try {
      const { api } = await import('./api.js');
      await api.logout();
    } catch {
      store.token = null;
      store.user = null;
    }
    setUser(null);
    go('/');
  }, []);

  const onLogin = useCallback((u) => {
    setUser(u);
    go(u.role === 'teacher' ? '/teacher' : '/student');
  }, []);

  const guard = (role, el) => {
    if (!authed) {
      go('/login');
      return null;
    }
    if (user.role !== role) {
      go(user.role === 'teacher' ? '/teacher' : '/student');
      return null;
    }
    return el;
  };

  const [p1, p2, p3] = route.parts;
  let page = null;
  if (route.path === '/') page = <Landing />;
  else if (route.path === '/login') page = authed ? null : <Login onLogin={onLogin} />;
  else if (p1 === 'student') {
    if (!p2) page = guard('student', <StudentHome user={user} onLogout={logout} />);
    else if (p2 === 'tests' && p3) page = guard('student', <StudentTest testId={p3} />);
    else if (p2 === 'practice' && p3) page = guard('student', <Practice sessionId={p3} />);
    else if (p2 === 'learn' && p3) page = guard('student', <Learn conceptId={p3} />);
  } else if (p1 === 'teacher') {
    if (!p2) page = guard('teacher', <TeacherOverview user={user} onLogout={logout} />);
    else if (p2 === 'tests' && p3) page = guard('teacher', <TeacherTest testId={p3} />);
    else if (p2 === 'students' && !p3) page = guard('teacher', <TeacherRoster />);
    else if (p2 === 'students' && p3) page = guard('teacher', <TeacherStudent studentId={p3} />);
    else if (p2 === 'lecture-planner') page = guard('teacher', <LecturePlanner />);
  }
  if (route.path === '/login' && authed) {
    go(user.role === 'teacher' ? '/teacher' : '/student');
    page = null;
  }

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-stone-900 focus:px-3 focus:py-1 focus:text-white">
        Skip to content
      </a>
      <ErrorBoundary>{page ?? <Landing />}</ErrorBoundary>
    </div>
  );
}
