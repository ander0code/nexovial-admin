import {useEffect, useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {LuTriangleAlert, LuMapPin, LuGauge, LuTrendingUp, LuCornerUpRight, LuArrowDown, LuShieldCheck, LuChevronRight, LuRadio} from 'react-icons/lu';
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
 * Severidad → acento suave. Para g-force usamos 3 niveles (crítico ≥0.6g,
 * alto ≥0.45g, moderado). SPEEDING reporta km/h, no g → alto por defecto.
 * `dot` colorea el punto del timeline; `tile` el ícono; `text` los valores;
 * `ring` el halo del punto del evento más reciente.
 */
type Tone = {dot: string; tile: string; text: string; ring: string; level: string};
function severityTone(a: Alert): Tone {
  if (a.type === 'SPEEDING') {
    return {dot: 'bg-amber-500', tile: 'bg-amber-500/12 text-amber-600', text: 'text-amber-600', ring: 'ring-amber-500/25', level: 'Alto'};
  }
  if (a.severity >= 0.6) return {dot: 'bg-danger', tile: 'bg-danger/12 text-danger', text: 'text-danger', ring: 'ring-danger/25', level: 'Crítico'};
  if (a.severity >= 0.45) return {dot: 'bg-amber-500', tile: 'bg-amber-500/12 text-amber-600', text: 'text-amber-600', ring: 'ring-amber-500/25', level: 'Alto'};
  return {dot: 'bg-primary', tile: 'bg-primary/12 text-primary', text: 'text-default-600', ring: 'ring-primary/25', level: 'Moderado'};
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

/**
 * Bucket cronológico de cada alerta para los encabezados del timeline.
 * "now" = últimos 10 min (la franja viva), luego Hoy / Ayer / Antes según el
 * día calendario local. El orden de las claves define el orden vertical.
 */
type BucketKey = 'now' | 'today' | 'yesterday' | 'older';
const BUCKET_LABEL: Record<BucketKey, string> = {
  now: 'Ahora',
  today: 'Hoy',
  yesterday: 'Ayer',
  older: 'Antes',
};
const BUCKET_ORDER: BucketKey[] = ['now', 'today', 'yesterday', 'older'];

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function bucketOf(iso: string, now: number): BucketKey {
  const t = new Date(iso).getTime();
  if (now - t < 10 * 60000) return 'now';
  const today = startOfDay(now);
  if (t >= today) return 'today';
  if (t >= today - 86400000) return 'yesterday';
  return 'older';
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

  // Reloj para que el "hace N min" y los buckets se mantengan frescos.
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

  // Agrupado cronológico para el timeline: respeta el orden (más reciente
  // primero) que ya trae la lista y reparte cada alerta en su franja.
  const groups = useMemo(() => {
    const out: Array<{key: BucketKey; items: AlertRow[]}> = [];
    const byKey = new Map<BucketKey, AlertRow[]>();
    for (const a of shown) {
      const k = bucketOf(a.timestamp, now);
      const arr = byKey.get(k);
      if (arr) arr.push(a);
      else byKey.set(k, [a]);
    }
    for (const key of BUCKET_ORDER) {
      const items = byKey.get(key);
      if (items && items.length) out.push({key, items});
    }
    return out;
  }, [shown, now]);

  // El identificador del evento más reciente del feed completo (sin filtrar):
  // recibe el chip "NUEVO" y el punto pulsante.
  const newestId = useMemo(() => {
    const a = alerts[0];
    return a ? (a.id ?? `${a.driverId}-${a.timestamp}`) : null;
  }, [alerts]);

  // Cada alerta lleva al viaje donde ocurrió el evento (la detecta por tripId).
  const goToTrip = (a: Alert) =>
    navigate(a.tripId ? `/drivers/${a.driverId}?trip=${a.tripId}` : `/drivers/${a.driverId}`);

  return (
    <div className="card">
      {/* Animaciones del feed: entrada de alertas por socket + latido del punto
          "en vivo". Ambas se anulan si el usuario pidió menos movimiento. */}
      <style>{`
        @keyframes nv-alert-in {
          from { opacity: 0; transform: translateY(-10px) scale(0.985); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes nv-live-ping {
          0%   { transform: scale(1);   opacity: 0.55; }
          70%  { transform: scale(2.4); opacity: 0; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        .nv-live-ping { animation: nv-live-ping 1.8s cubic-bezier(0,0,0.2,1) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .nv-alert-anim { animation: none !important; }
          .nv-live-ping  { animation: none !important; opacity: 0 !important; }
        }
      `}</style>

      <div className="card-header gap-4">
        <div className="min-w-0">
          <h6 className="card-title">Feed de eventos severos</h6>
          <p className="text-sm text-default-500 mt-0.5 truncate">lo más reciente arriba · nuevos eventos llegan solos, sin refrescar</p>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-2 text-xs font-semibold rounded-full ps-2.5 pe-3 py-1.5 border ${
          live ? 'text-success bg-success/10 border-success/20' : 'text-default-400 bg-default-100 border-default-200'
        }`}>
          <span className="relative grid place-items-center size-2">
            {live && <span className="absolute inset-0 rounded-full bg-success nv-live-ping" />}
            <span className={`relative size-2 rounded-full ${live ? 'bg-success' : 'bg-default-300'}`} />
          </span>
          <span className="inline-flex items-center gap-1">
            <LuRadio className="size-3.5" />
            {live ? 'tiempo real' : 'desconectado'}
          </span>
        </span>
      </div>

      {/* Filtros por tipo — sin borde duro, separados solo por espacio */}
      {alerts.length > 0 && (
        <div className="card-body pt-2 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilter(null)}
              className={`inline-flex items-center gap-1.5 text-sm font-medium rounded-full ps-3.5 pe-3 py-1.5 border transition-colors ${
                filter === null ? 'bg-primary text-white border-primary' : 'bg-default-50 text-default-600 border-default-200 hover:border-default-300'
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
                    active ? 'bg-primary text-white border-primary' : 'bg-default-50 text-default-600 border-default-200 hover:border-default-300'
                  }`}>
                  <Icon className="size-3.5" />
                  {EVENT_SHORT[t] ?? t} <span className="font-mono">{counts[t]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="card-body pt-2">
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
          // Timeline vertical: un riel sutil baja por la izquierda y cada evento
          // cuelga de un punto. De arriba (más reciente) hacia abajo (más antiguo).
          <div className="flex flex-col gap-6">
            {groups.map(group => (
              <section key={group.key}>
                {/* Encabezado de franja temporal */}
                <div className="flex items-center gap-2.5 mb-3 ps-0.5">
                  <span className="label-tech text-[11px] text-default-400">{BUCKET_LABEL[group.key]}</span>
                  {group.key === 'now' && live && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-success">
                      <span className="size-1.5 rounded-full bg-success" />
                      en vivo
                    </span>
                  )}
                  <span className="h-px flex-grow bg-default-200/70" />
                  <span className="font-mono text-[11px] text-default-400">{group.items.length}</span>
                </div>

                {/* Riel + eventos de la franja */}
                <ul className="relative flex flex-col gap-2.5 ps-7">
                  {/* El riel vertical que hace obvio el orden cronológico */}
                  <span aria-hidden className="absolute start-[11px] top-1 bottom-1 w-px bg-gradient-to-b from-default-200 via-default-200 to-transparent" />
                  {group.items.map((a, i) => {
                    const tone = severityTone(a);
                    const Icon = EVENT_ICON[a.type] ?? LuTriangleAlert;
                    const rowId = a.id ?? `${a.driverId}-${a.timestamp}`;
                    const isNewest = rowId === newestId && !filter;
                    return (
                      <li
                        key={a.id ?? `${a.driverId}-${a.timestamp}-${i}`}
                        className="relative"
                        style={a._new ? {animation: 'nv-alert-in .4s cubic-bezier(0.16,1,0.3,1) both'} : undefined}>
                        {/* Punto del timeline alineado con el riel */}
                        <span aria-hidden className="absolute -start-[23px] top-4 grid place-items-center size-2.5">
                          {isNewest && <span className={`absolute inset-0 rounded-full ${tone.dot} nv-live-ping`} />}
                          <span className={`relative size-2.5 rounded-full ${tone.dot} ring-4 ring-card ${isNewest ? `ring-offset-0 shadow-[0_0_0_4px] ${tone.ring}` : ''}`} />
                        </span>

                        {/* Tarjeta del evento */}
                        <div
                          onClick={() => goToTrip(a)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToTrip(a); } }}
                          title="Ver el viaje de esta alerta"
                          className={`${a._new ? 'nv-alert-anim' : ''} group flex items-start gap-3 p-3.5 rounded-2xl bg-default-50/70 hover:bg-default-100 ring-1 transition-all cursor-pointer ${
                            isNewest ? 'ring-primary/25 bg-primary/[0.04] hover:bg-primary/[0.06]' : 'ring-default-200/60 hover:ring-default-300/70'
                          }`}>
                          <span className={`size-9 rounded-xl grid place-items-center shrink-0 ${tone.tile}`}>
                            <Icon className="size-4.5" />
                          </span>
                          <div className="flex-grow min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-default-800">{EVENT_LABEL[a.type] ?? a.type}</p>
                              <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full ${tone.tile}`}>{tone.level}</span>
                              {isNewest && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full bg-primary text-white">
                                  <span className="size-1.5 rounded-full bg-white/90" />
                                  Nuevo
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-default-500 mt-1">
                              <strong className="text-default-700">{a.driverName}</strong>
                              {' · '}
                              <span className={`font-mono font-semibold ${tone.text}`}>
                                {a.type === 'SPEEDING' ? `+${a.severity} km/h` : `${a.severity.toFixed(2)}g`}
                              </span>
                              {' · '}
                              <span className="font-medium text-default-600" title={new Date(a.timestamp).toLocaleString('es-PE')}>
                                {relativeTime(a.timestamp, now)}
                              </span>
                            </p>
                          </div>
                          <div className="shrink-0 self-center flex flex-col items-end gap-1.5">
                            {a.lat !== null && a.lng !== null && (
                              <span className="inline-flex items-center gap-1.5 text-xs text-default-400 font-mono">
                                <LuMapPin className="size-3.5" />
                                {a.lat.toFixed(2)}, {a.lng.toFixed(2)}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-70 group-hover:opacity-100 transition-opacity">
                              Ver viaje <LuChevronRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
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
