import {useState} from 'react';
import {Link, Navigate, Outlet, Route, Routes, useLocation} from 'react-router-dom';
import {isLoggedIn} from '@/auth';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import Alerts from '@/pages/Alerts';
import DriverDetail from '@/pages/DriverDetail';
import Drivers from '@/pages/Drivers';
import Login from '@/pages/Login';
import Rankings from '@/pages/Rankings';
import Resumen from '@/pages/Resumen';

const PAGE_TITLE: Record<string, string> = {
  '/resumen': 'Resumen de flota',
  '/rankings': 'Ranking de conductores',
  '/alerts': 'Alertas de riesgo',
  '/drivers': 'Conductores',
};

function PageHeader({title}: {title: string}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <h4 className="text-xl font-semibold text-default-800">{title}</h4>
      <nav className="flex items-center gap-1.5 text-sm text-default-500">
        <Link to="/resumen" className="hover:text-primary">NexoVial</Link>
        <span>›</span>
        <span className="text-default-700">{title}</span>
      </nav>
    </div>
  );
}

function Layout() {
  const {pathname} = useLocation();
  const [hidden, setHidden] = useState(false);

  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />;
  }

  const section = '/' + (pathname.split('/')[1] ?? '');
  const title = PAGE_TITLE[section] ?? 'NexoVial';

  return (
    <div className={`wrapper ${hidden ? 'sidenav-hidden' : ''}`}>
      {!hidden && <Sidebar />}
      <div className="page-content">
        <Topbar onToggleSidebar={() => setHidden(h => !h)} />
        <main>
          <PageHeader title={title} />
          <Outlet />
        </main>
        <footer className="px-6 py-4 border-t border-default-200 text-xs text-default-500">
          © 2026 NexoVial — Prevención que premia · Lima, PE
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/resumen" replace />} />
        <Route path="/resumen" element={<Resumen />} />
        <Route path="/rankings" element={<Rankings />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/drivers" element={<Drivers />} />
        <Route path="/drivers/:id" element={<DriverDetail />} />
      </Route>
    </Routes>
  );
}
