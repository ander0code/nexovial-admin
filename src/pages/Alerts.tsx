import {useEffect, useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {LuTriangleAlert, LuMapPin, LuGauge, LuTrendingUp, LuCornerUpRight, LuArrowDown, LuShieldCheck, LuChevronRight} from 'react-icons/lu';
import type {IconType} from 'react-icons';
import {api, type Alert} from '@/api/client';
import {getAdmin} from '@/auth';
import {getSocket} from '@/api/socket';

type AlertRow = Alert & {_new?: boolean};

const EVENT_LABEL: Record<string, string> = {
  HARD_BRAKE: 'Frenada brusca',
  HARSH_ACCEL: 'Aceleración agresiva',
  SHARP_TURN: 'Giro brusco / zigzagueo',
  SPEEDING: 'Exceso de velocidad',
};
const EVENT_SHORT: Record<string, string> = {
  HARD_BRAKE: 'Frenada',
  HARSH_ACCEL: 'Aceleración',
  SHARP_TURN: 'Giro',
  SPEEDING: 'Velocidad',
};
const EVENT_ICON: Record<string, IconType> = {
  HARD_BRAKE: LuArrowDown,
  HARSH_ACCEL: LuTrendingUp,
  SHARP_TURN: LuCornerUpRight,
  SPEEDING: LuGauge,
};
const FILTER_ORDER = ['HARD_BRAKE', 'HARSH_ACCEL', 'SHARP_TURN', 'SPEEDING'];

/**
 * Severidad → acento. Para g-force usamos 3 niveles (crítico ≥0.6g, alto ≥0.45g,
 * moderado). SPEEDING reporta km/h, no g, así que se trata como alto por defecto.
 */
function severityTone(a: Alert): {border: string; chip: string; iconWrap: string; level: string} {
  if (a.type === 'SPEEDING') {
    return {border: 'border-s-amber-500', chip: 'text-amber-600', iconWrap: 'bg-amber-500/10 text-amber-600', level: 'Alto'};
  }
  if (a.severity >= 0.6) return {border: 'border-s-danger', chip: 'text-danger', iconWrap: 'bg-danger/10 text-danger', level: 'Crítico'};
  if (a.severity >= 0.45) return {border: 'border-s-amber-500', chip: 'text-amber-600', iconWrap: 'bg-amber-500/10 text-amber-600', level: 'Alto'};
  return {border: 'border-s-primary', chip: 'text-default-600', iconWrap: 'bg-primary/10 text-primary', level: 'Moderado'};
}

function relativeTime(iso: string, now: number): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'ahora mismo';
  if (min === 1) return 'hace 1 min';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h === 1) return 'hace 1 h';
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ayer';
  if (d < 7) return `hace ${d} días`;
  return new Date(iso).toLocaleDateString('es-PE', {day: '2-digit', month: 'short'});
}

export default function Alerts() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [live, setLive] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    api.get('/api/admin/alerts').then(({data}) => setAlerts(data.alerts));
  }, []);

  useEffect(() => {
    const admin = getAdmin();
    if (!admin) return;
    const socket = getSocket(admin.companyId);
    const onAlert = (alert: Alert) => setAlerts(prev => [{...alert, _new: true}, ...prev].slice(0, 100));
    socket.on('new_alert', onAlert);
    socket.on('connect', () => setLive(true));
    socket.on('disconnect', () => setLive(false));
    setLive(socket.connected);
    return () => { socket.off('new_alert', onAlert); };
  }, []);

  // Reloj para que el "hace N min" se mantenga fresco sin recargar.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of alerts) c[a.type] = (c[a.type] ?? 0) + 1;
    return c;
  }, [alerts]);

  const activeFilters = useMemo(() => FILTER_ORDER.filter(t => counts[t] > 0), [counts]);
  const shown = useMemo(() => filter ? alerts.filter(a => a.type === filter) : alerts, [alerts, filter]);

  // Cada alerta lleva al viaje donde ocurrió el evento (la detecta por tripId).
  const goToTrip = (a: Alert) =>
    navigate(a.tripId ? `/drivers/${a.driverId}?trip=${a.tripId}` : `/drivers/${a.driverId}`);

  return (
    <div className="card">
      {/* Animación de entrada para alertas que llegan por socket. Desactivada
          automáticamente si el usuario pidió menos movimiento. */}
      <style>{`
        @keyframes nv-alert-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .nv-alert-anim { animation: none !important; }
        }
      `}</style>
      <div className="card-header gap-4">
        <div className="min-w-0">
          <h6 className="card-title">Feed de eventos severos</h6>
          <p className="text-sm text-default-500 mt-0.5 truncate">los eventos nuevos aparecen solos, sin refrescar</p>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-medium ${live ? 'text-success' : 'text-default-400'}`}>
          <span className={`size-2 rounded-full ${live ? 'bg-success animate-pulse' : 'bg-default-300'}`} />
          {live ? 'tiempo real' : 'desconectado'}
        </span>
      </div>

      {/* Filtros por tipo */}
      {alerts.length > 0 && (
        <div className="card-body border-t border-default-200 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilter(null)}
              className={`inline-flex items-center gap-1.5 text-sm font-medium rounded-full ps-3 pe-3 py-1.5 border transition-colors ${
                filter === null ? 'bg-primary text-white border-primary' : 'bg-card text-default-600 border-default-200 hover:border-default-300'
              }`}>
              Todos <span className="font-mono">{alerts.length}</span>
            </button>
            {activeFilters.map(t => {
              const Icon = EVENT_ICON[t] ?? LuTriangleAlert;
              const active = filter === t;
              return (
                <button
                  key={t}
                  onClick={() => setFilter(active ? null : t)}
                  className={`inline-flex items-center gap-1.5 text-sm font-medium rounded-full ps-2.5 pe-3 py-1.5 border transition-colors ${
                    active ? 'bg-primary text-white border-primary' : 'bg-card text-default-600 border-default-200 hover:border-default-300'
                  }`}>
                  <Icon className="size-3.5" />
                  {EVENT_SHORT[t] ?? t} <span className="font-mono">{counts[t]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="card-body">
        {shown.length === 0 ? (
          <div className="text-center py-14">
            <div className="size-14 rounded-full bg-success/10 text-success grid place-items-center mx-auto mb-4">
              <LuShieldCheck className="size-7" />
            </div>
            <p className="text-default-700 font-medium">
              {filter ? 'Sin alertas de este tipo' : 'Sin alertas — flota tranquila'}
            </p>
            <p className="text-default-400 text-sm mt-1">
              {filter ? 'Prueba con otro filtro o vuelve a "Todos".' : 'No se han registrado eventos severos. Buen manejo en la flota.'}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {shown.map((a, i) => {
              const tone = severityTone(a);
              const Icon = EVENT_ICON[a.type] ?? LuTriangleAlert;
              return (
                <li
                  key={a.id ?? `${a.driverId}-${a.timestamp}-${i}`}
                  onClick={() => goToTrip(a)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToTrip(a); } }}
                  title="Ver el viaje de esta alerta"
                  style={a._new ? {animation: 'nv-alert-in .35s ease both'} : undefined}
                  className={`${a._new ? 'nv-alert-anim' : ''} flex items-start gap-3 p-3.5 rounded border border-default-200 border-s-[3px] ${tone.border} bg-card cursor-pointer hover:bg-default-50 hover:border-default-300 transition-colors`}>
                  <span className={`size-9 rounded-full grid place-items-center shrink-0 ${tone.iconWrap}`}>
                    <Icon className="size-4.5" />
                  </span>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-default-800">{EVENT_LABEL[a.type] ?? a.type}</p>
                      <span className={`inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded ${tone.iconWrap}`}>{tone.level}</span>
                    </div>
                    <p className="text-sm text-default-500 mt-0.5">
                      <strong className="text-default-700">{a.driverName}</strong>
                      {' · '}
                      <span className={`font-mono font-medium ${tone.chip}`}>
                        {a.type === 'SPEEDING' ? `+${a.severity} km/h` : `${a.severity.toFixed(2)}g`}
                      </span>
                      {' · '}
                      <span title={new Date(a.timestamp).toLocaleString('es-PE')}>{relativeTime(a.timestamp, now)}</span>
                    </p>
                  </div>
                  <div className="shrink-0 self-center flex flex-col items-end gap-1">
                    {a.lat !== null && a.lng !== null && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-default-400 font-mono">
                        <LuMapPin className="size-3.5" />
                        {a.lat.toFixed(2)}, {a.lng.toFixed(2)}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                      Ver viaje <LuChevronRight className="size-3.5" />
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card-footer">
        <p className="text-sm text-default-500">
          {filter
            ? <>{shown.length} {EVENT_SHORT[filter]?.toLowerCase()} · {alerts.length} en total</>
            : <>{alerts.length} alerta{alerts.length !== 1 ? 's' : ''} severa{alerts.length !== 1 ? 's' : ''}</>}
        </p>
        <p className="text-sm text-default-400">últimos 100 eventos</p>
      </div>
    </div>
  );
}
