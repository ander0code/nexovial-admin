import {useEffect, useRef, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {LuSearch, LuBellRing, LuMenu} from 'react-icons/lu';
import {api, type Alert, type DriverSummary} from '@/api/client';
import {getAdmin} from '@/auth';
import {getSocket} from '@/api/socket';

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
      <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none text-default-400">
        <LuSearch className="text-base" />
      </div>
      <input
        ref={inputRef}
        value={query}
        onChange={e => {setQuery(e.target.value); setOpen(true);}}
        onFocus={() => setOpen(true)}
        type="text"
        className="w-80 rounded-full border border-default-200 bg-card ps-11 pe-16 py-2.5 text-sm text-default-800 placeholder:text-default-400 focus:ring-2 focus:ring-primary/20 transition-colors"
        placeholder="Buscar conductor…"
      />
      <div className="absolute inset-y-0 end-0 flex items-center pe-3 pointer-events-none">
        <kbd className="font-mono text-[11px] text-default-400 bg-card border border-default-200 rounded px-1.5 py-0.5">⌘K</kbd>
      </div>

      {open && query.trim() && (
        <div className="absolute top-full mt-2 inset-x-0 z-50 bg-card border border-default-200 rounded-2xl shadow-[0_8px_30px_-8px_rgb(15_23_42/0.20)] p-1.5">
          {results.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-default-500">Sin coincidencias para “{query}”</p>
          ) : (
            results.slice(0, 6).map(d => (
              <button
                key={d.id}
                onClick={() => {setQuery(''); setOpen(false); navigate(`/drivers/${d.id}`);}}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-default-100 text-start">
                <span className="size-9 rounded-full bg-default-200 text-default-700 grid place-items-center text-xs font-bold shrink-0">{initials(d.name)}</span>
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
    <div className="relative" ref={ref}>
      <button
        onClick={() => {setOpen(v => !v); if (!open) setUnseen(0);}}
        className="relative inline-flex items-center justify-center size-10 rounded-full bg-card border border-default-200 text-default-600 hover:bg-default-100 transition-colors"
        aria-label="Notificaciones">
        <LuBellRing className="size-5" />
        {unseen > 0 && (
          <span className="absolute top-1 end-1 min-w-4 h-4 px-1 grid place-items-center bg-danger text-white text-[10px] font-bold rounded-full border-2 border-card">
            {unseen > 9 ? '9+' : unseen}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-2 z-50 w-80 bg-card border border-default-200 rounded-2xl shadow-[0_8px_30px_-8px_rgb(15_23_42/0.20)] p-1.5">
          <p className="px-3 py-2 text-sm font-bold text-default-700">Alertas recientes</p>
          {alerts.length === 0 ? (
            <p className="px-3 py-4 text-sm text-default-500 text-center">Sin eventos severos. Buen manejo en la flota.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {alerts.map((a, i) => (
                <div key={a.id ?? i} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl hover:bg-default-100">
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
          <Link to="/alerts" onClick={() => setOpen(false)} className="block text-center py-2.5 mt-1 border-t border-default-200 text-sm font-bold text-primary">
            Ver todas las alertas →
          </Link>
        </div>
      )}
    </div>
  );
}

export default function Topbar({onToggleSidebar}: {onToggleSidebar: () => void}) {
  return (
    <header className="min-h-topbar-height flex items-center sticky top-0 z-30 bg-(--topbar-background)">
      <div className="w-full flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button onClick={onToggleSidebar} className="inline-flex items-center justify-center size-10 rounded-full text-default-600 hover:bg-default-200 transition-colors" aria-label="Mostrar / ocultar menú">
            <LuMenu className="size-5" />
          </button>
          <SearchBox />
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center text-xs font-semibold text-primary bg-primary/10 rounded-full px-3.5 py-2">Flota Demo SAC</span>
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
