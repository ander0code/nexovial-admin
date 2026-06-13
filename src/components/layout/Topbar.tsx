import {useEffect, useRef, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {LuSearch, LuSun, LuMoon, LuBellRing, LuLogOut, LuChevronDown, LuMenu} from 'react-icons/lu';
import {api, type Alert, type DriverSummary} from '@/api/client';
import {clearSession, getAdmin} from '@/auth';
import {disconnectSocket, getSocket} from '@/api/socket';
import {useTheme} from '@/useTheme';

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();
}

const EVENT_LABEL: Record<string, string> = {
  HARD_BRAKE: 'Frenada brusca',
  HARSH_ACCEL: 'Aceleración agresiva',
  SHARP_TURN: 'Giro brusco',
  SPEEDING: 'Exceso de velocidad',
};

function useClickOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);
  return ref;
}

function SearchBox() {
  const [query, setQuery] = useState('');
  const [drivers, setDrivers] = useState<DriverSummary[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useClickOutside(() => setOpen(false));
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/admin/drivers').then(({data}) => setDrivers(data.drivers));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') inputRef.current?.blur();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const results = query.trim()
    ? drivers.filter(d => d.name.toLowerCase().includes(query.toLowerCase()) || d.code.toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <div className="lg:flex hidden items-center relative" ref={ref}>
      <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-default-500">
        <LuSearch className="text-base" />
      </div>
      <input
        ref={inputRef}
        value={query}
        onChange={e => {setQuery(e.target.value); setOpen(true);}}
        onFocus={() => setOpen(true)}
        type="text"
        className="form-input ps-10 pe-16 text-sm rounded w-72"
        placeholder="Buscar conductor…"
      />
      <div className="absolute inset-y-0 end-0 flex items-center pe-3 pointer-events-none">
        <kbd className="font-medium text-xs text-default-400 border border-default-200 rounded px-1.5 py-0.5">⌘K</kbd>
      </div>

      {open && query.trim() && (
        <div className="absolute top-full mt-2 inset-x-0 z-50 bg-card border border-default-200 rounded shadow-lg p-1.5">
          {results.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-default-500">Sin coincidencias para “{query}”</p>
          ) : (
            results.slice(0, 6).map(d => (
              <button
                key={d.id}
                onClick={() => {setQuery(''); setOpen(false); navigate(`/drivers/${d.id}`);}}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded hover:bg-default-100 text-start">
                <span className="size-9 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold shrink-0">{initials(d.name)}</span>
                <span className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-default-800">{d.name}</span>
                  <span className="text-xs text-default-500">{d.code} · {d.trips} viajes</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function NotificationBell() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const ref = useClickOutside(() => setOpen(false));

  useEffect(() => {
    api.get('/api/admin/alerts').then(({data}) => setAlerts(data.alerts.slice(0, 8)));
  }, []);

  useEffect(() => {
    const admin = getAdmin();
    if (!admin) return;
    const socket = getSocket(admin.companyId);
    const onAlert = (alert: Alert) => {
      setAlerts(prev => [alert, ...prev].slice(0, 8));
      setUnseen(n => n + 1);
    };
    socket.on('new_alert', onAlert);
    return () => {socket.off('new_alert', onAlert);};
  }, []);

  return (
    <div className="relative topbar-item" ref={ref}>
      <button
        onClick={() => {setOpen(v => !v); if (!open) setUnseen(0);}}
        className="relative inline-flex items-center justify-center size-9.5 rounded-full text-default-600 hover:bg-default-100 transition-colors"
        aria-label="Notificaciones">
        <LuBellRing className="size-5" />
        {unseen > 0 && (
          <span className="absolute top-1 end-1 min-w-4 h-4 px-1 grid place-items-center bg-danger text-white text-[10px] font-bold rounded-full border-2 border-card">
            {unseen > 9 ? '9+' : unseen}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-2 z-50 w-80 bg-card border border-default-200 rounded shadow-lg p-1.5">
          <p className="px-3 py-2 text-sm font-semibold text-default-500 border-b border-default-200">Alertas recientes</p>
          {alerts.length === 0 ? (
            <p className="px-3 py-4 text-sm text-default-500 text-center">Sin eventos severos. Buen manejo en la flota.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {alerts.map((a, i) => (
                <div key={a.id ?? i} className="flex items-start gap-2.5 px-3 py-2.5 rounded hover:bg-default-100">
                  <span className="size-2 rounded-full bg-danger mt-1.5 shrink-0" />
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-default-800">{EVENT_LABEL[a.type] ?? a.type}</span>
                    <span className="text-xs text-default-500">
                      {a.driverName} · {a.type === 'SPEEDING' ? `+${a.severity} km/h` : `${a.severity.toFixed(2)}g`}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
          <Link to="/alerts" onClick={() => setOpen(false)} className="block text-center py-2.5 mt-1 border-t border-default-200 text-sm font-semibold text-primary">
            Ver todas las alertas →
          </Link>
        </div>
      )}
    </div>
  );
}

function ProfileMenu({name}: {name: string}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const navigate = useNavigate();

  const logout = () => {
    clearSession();
    disconnectSocket();
    navigate('/login');
  };

  return (
    <div className="relative topbar-item" ref={ref}>
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2.5 ps-1 pe-2.5 py-1 rounded-full hover:bg-default-100 transition-colors">
        <span className="size-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold">{initials(name)}</span>
        <span className="text-sm font-semibold text-default-800">{name}</span>
        <LuChevronDown className="size-3.5 text-default-500" />
      </button>
      {open && (
        <div className="absolute end-0 top-full mt-2 z-50 min-w-52 bg-card border border-default-200 rounded shadow-lg p-1.5">
          <p className="px-3 py-2 text-sm font-semibold text-default-500 border-b border-default-200">¡Hola, {name.split(' ')[0]}!</p>
          <button onClick={logout} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded text-sm text-danger hover:bg-danger/10">
            <LuLogOut className="size-4" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

export default function Topbar({onToggleSidebar}: {onToggleSidebar: () => void}) {
  const {theme, toggle} = useTheme();
  const admin = getAdmin();

  return (
    <header className="app-header min-h-topbar-height flex items-center sticky top-0 z-30 bg-(--topbar-background) border-b border-default-200">
      <div className="w-full flex items-center justify-between px-6">
        <div className="flex items-center gap-5">
          <button onClick={onToggleSidebar} className="inline-flex items-center justify-center size-9.5 rounded-full text-default-600 hover:bg-default-100" aria-label="Menú">
            <LuMenu className="size-5" />
          </button>
          <SearchBox />
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex text-xs font-medium text-primary bg-primary/10 rounded-full px-3.5 py-1.5">Flota Demo SAC</span>
          <button onClick={toggle} className="inline-flex items-center justify-center size-9.5 rounded-full text-default-600 hover:bg-default-100" aria-label="Cambiar tema">
            {theme === 'dark' ? <LuSun className="size-5" /> : <LuMoon className="size-5" />}
          </button>
          <NotificationBell />
          <ProfileMenu name={admin?.name ?? 'Admin'} />
        </div>
      </div>
    </header>
  );
}
