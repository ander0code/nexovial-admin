import {useEffect, useMemo, useState} from 'react';
import {Link, useParams, useSearchParams} from 'react-router-dom';
import {
  LuChevronLeft, LuChevronRight, LuCar, LuCalendarClock, LuRoute, LuShield, LuMapPin,
  LuTriangleAlert, LuPhone, LuIdCard, LuBadgeCheck, LuClock,
} from 'react-icons/lu';
import type {IconType} from 'react-icons';
import {api, type DriverDetail as DriverDetailType, type ScheduleBlock, type VehicleType, type TripDetail} from '@/api/client';
import TripMap from '@/components/TripMap';

const EVENT_COLOR: Record<string, string> = {
  HARD_BRAKE: '#D8453C',
  HARSH_ACCEL: '#E0922A',
  SHARP_TURN: '#7C5CFC',
  SPEEDING: '#2570B8',
};

const EVENT_LABEL: Record<string, string> = {
  HARD_BRAKE: 'Frenada',
  HARSH_ACCEL: 'Aceleración',
  SHARP_TURN: 'Giro',
  SPEEDING: 'Velocidad',
};

const VEHICLE_LABEL: Record<VehicleType, string> = {
  SEDAN: 'Sedán',
  SUV: 'SUV',
  VAN: 'Van',
  PICKUP: 'Pickup',
  TRUCK: 'Camión',
  BUS: 'Bus',
  MOTORCYCLE: 'Motocicleta',
};

// Lunes a domingo en orden de lectura (dayOfWeek: 0=Dom … 6=Sáb).
const WEEK: Array<{day: number; label: string; long: string}> = [
  {day: 1, label: 'Lun', long: 'Lunes'},
  {day: 2, label: 'Mar', long: 'Martes'},
  {day: 3, label: 'Mié', long: 'Miércoles'},
  {day: 4, label: 'Jue', long: 'Jueves'},
  {day: 5, label: 'Vie', long: 'Viernes'},
  {day: 6, label: 'Sáb', long: 'Sábado'},
  {day: 0, label: 'Dom', long: 'Domingo'},
];

const DAY_MIN = 24 * 60;

function scoreColor(score: number): string {
  if (score >= 90) return 'text-success';
  if (score >= 80) return 'text-amber-600';
  return 'text-danger';
}

function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function severityText(type: string, severity: number): string {
  return type === 'SPEEDING' ? `+${severity} km/h` : `${severity.toFixed(2)}g`;
}

/** Devuelve el bloque WORK y BREAK (si hay) de un día. */
function blocksForDay(schedule: ScheduleBlock[], day: number) {
  const ofDay = schedule.filter(b => b.dayOfWeek === day);
  const work = ofDay.find(b => b.kind === 'WORK') ?? null;
  const rest = ofDay.find(b => b.kind === 'BREAK') ?? null;
  return {work, rest};
}

type TabId = 'trips' | 'schedule' | 'vehicle';

// ── KPI compacto (icono + valor + label en fila) — 2×2 junto a la identidad ──
function CompactKpi({tone, Icon, label, value, valueClass}: {
  tone: string; Icon: IconType; label: string; value: React.ReactNode; valueClass?: string;
}) {
  return (
    <div className="card h-full">
      <div className="card-body p-4 h-full flex items-center gap-3">
        <span className={`size-10 rounded grid place-items-center shrink-0 ${tone}`}><Icon className="size-5" /></span>
        <div className="min-w-0">
          <h4 className={`text-xl font-bold leading-none ${valueClass ?? ''}`}>{value}</h4>
          <p className="text-xs text-default-500 mt-1.5 leading-tight">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default function DriverDetail() {
  const {id} = useParams();
  const [searchParams] = useSearchParams();
  const tripParam = searchParams.get('trip'); // al venir desde una alerta
  const [driver, setDriver] = useState<DriverDetailType | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('trips');

  useEffect(() => {
    if (id) api.get(`/api/admin/drivers/${id}`).then(({data}) => setDriver(data));
  }, [id]);

  // Selección por defecto: si venimos de una alerta (?trip=), ese viaje; si no, el
  // más reciente con ruta (cae al más reciente). Los viajes vienen ordenados desc.
  useEffect(() => {
    if (!driver || driver.trips.length === 0) return;
    setSelectedTripId(prev => {
      if (tripParam && driver.trips.some(t => t.id === tripParam)) return tripParam;
      if (prev && driver.trips.some(t => t.id === prev)) return prev;
      const withRoute = driver.trips.find(t => t.route && t.route.length > 0);
      return (withRoute ?? driver.trips[0]).id;
    });
    if (tripParam) setTab('trips');
  }, [driver, tripParam]);

  const selectedTrip = useMemo(
    () => driver?.trips.find(t => t.id === selectedTripId) ?? null,
    [driver, selectedTripId],
  );

  // KPIs agregados de todos los viajes.
  const kpis = useMemo(() => {
    const trips = driver?.trips ?? [];
    const totalKm = trips.reduce((s, t) => s + t.distance, 0);
    const totalEvents = trips.reduce((s, t) => s + t.events.length, 0);
    const avgScore = trips.length > 0 ? Math.round(trips.reduce((s, t) => s + t.score, 0) / trips.length) : null;
    return {count: trips.length, totalKm, totalEvents, avgScore};
  }, [driver]);

  if (!driver) {
    return <div className="card"><div className="card-body"><p className="text-default-500">Cargando…</p></div></div>;
  }

  const {schedule} = driver;

  const TABS: Array<{id: TabId; label: string; Icon: IconType}> = [
    {id: 'trips', label: 'Viajes y ruta', Icon: LuRoute},
    {id: 'schedule', label: 'Horario', Icon: LuCalendarClock},
    {id: 'vehicle', label: 'Vehículo', Icon: LuCar},
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* ── Volver: AFUERA del contenedor, arriba ── */}
      <Link
        to="/drivers"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-default-500 hover:text-primary w-fit">
        <LuChevronLeft className="size-4" /> Volver a conductores
      </Link>

      {/* ── Identidad (izq, nombre · código) + KPIs compactos 2×2 (der) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Identidad */}
        <div className="xl:col-span-7 card h-full">
          <div className="card-body h-full flex flex-col justify-center gap-4 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-2xl font-bold text-default-800 truncate">{driver.name}</h3>
                <p className="text-sm text-default-500 mt-0.5">Conductor de flota</p>
              </div>
              <span className="shrink-0 font-mono font-bold tracking-widest text-primary bg-primary/10 rounded-md px-3 py-1.5">
                {driver.code}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 border-t border-default-200 text-sm">
              {driver.vehicle && (
                <span className="inline-flex items-center gap-2 text-default-600">
                  <LuCar className="size-4 text-default-400" />
                  <span className="font-mono font-semibold text-default-800">{driver.vehicle.plate}</span>
                  <span className="text-default-400">·</span> {VEHICLE_LABEL[driver.vehicle.type] ?? driver.vehicle.type}
                </span>
              )}
              {driver.phone && (
                <span className="inline-flex items-center gap-2 text-default-600"><LuPhone className="size-4 text-default-400" /> {driver.phone}</span>
              )}
              {driver.license && (
                <span className="inline-flex items-center gap-2 text-default-600"><LuIdCard className="size-4 text-default-400" /> Lic. {driver.license}</span>
              )}
            </div>
          </div>
        </div>

        {/* KPIs compactos 2×2 — grid-rows-2 para que llenen la altura de la tarjeta */}
        <div className="xl:col-span-5 grid grid-cols-2 grid-rows-2 gap-4">
          <CompactKpi
            tone={kpis.avgScore === null ? 'bg-default-100 text-default-500' : kpis.avgScore >= 90 ? 'bg-success/15 text-success' : kpis.avgScore >= 80 ? 'bg-amber-500/15 text-amber-600' : 'bg-danger/10 text-danger'}
            Icon={LuShield} label="Score promedio" value={kpis.avgScore ?? '—'}
            valueClass={kpis.avgScore !== null ? scoreColor(kpis.avgScore) : ''} />
          <CompactKpi tone="bg-primary/10 text-primary" Icon={LuRoute} label="Viajes" value={kpis.count} />
          <CompactKpi tone="bg-success/15 text-success" Icon={LuMapPin} label="Km recorridos" value={kpis.totalKm.toFixed(1)} />
          <CompactKpi tone="bg-danger/10 text-danger" Icon={LuTriangleAlert} label="Eventos de riesgo" value={kpis.totalEvents} />
        </div>
      </div>

      {/* ── Barra de tabs ── */}
      <div className="card">
        <div className="border-b border-default-200 px-5">
          <div className="flex gap-1 -mb-px overflow-x-auto">
            {TABS.map(t => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`inline-flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    active ? 'border-primary text-primary' : 'border-transparent text-default-500 hover:text-default-700'
                  }`}>
                  <t.Icon className="size-4" /> {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="card-body">
          {tab === 'trips' && (
            <TripsTab driver={driver} selectedTrip={selectedTrip} selectedTripId={selectedTripId} onSelect={setSelectedTripId} />
          )}
          {tab === 'schedule' && <ScheduleTab schedule={schedule} />}
          {tab === 'vehicle' && <VehicleTab driver={driver} />}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Viajes y ruta ──────────────────────────────────────────────────────
const TRIPS_PER_PAGE = 4;

function TripsTab({driver, selectedTrip, selectedTripId, onSelect}: {
  driver: DriverDetailType;
  selectedTrip: TripDetail | null;
  selectedTripId: string | null;
  onSelect: (id: string) => void;
}) {
  const [page, setPage] = useState(0);

  if (driver.trips.length === 0) {
    return (
      <div className="text-center py-14">
        <div className="size-12 rounded-full bg-default-100 text-default-400 grid place-items-center mx-auto mb-3"><LuRoute className="size-6" /></div>
        <p className="text-default-600 font-medium">Sin viajes registrados</p>
        <p className="text-default-400 text-sm mt-1">Este conductor aún no ha sincronizado viajes.</p>
      </div>
    );
  }

  const totalKm = driver.trips.reduce((s, t) => s + t.distance, 0);
  const pageCount = Math.max(1, Math.ceil(driver.trips.length / TRIPS_PER_PAGE));
  const current = Math.min(page, pageCount - 1);
  const shown = driver.trips.slice(current * TRIPS_PER_PAGE, current * TRIPS_PER_PAGE + TRIPS_PER_PAGE);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      {/* Mapa */}
      <div className="xl:col-span-7 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-default-500 px-1">
          <LuMapPin className="size-4 text-primary shrink-0" />
          {selectedTrip
            ? <span className="truncate">Ruta del <span className="text-default-700 font-medium">{new Date(selectedTrip.startTime).toLocaleString('es-PE')}</span></span>
            : <span>Selecciona un viaje para ver su ruta</span>}
        </div>
        {selectedTrip
          ? <TripMap route={selectedTrip.route} events={selectedTrip.events} height={460} />
          : <div className="card"><div className="h-[460px] grid place-items-center text-default-400 text-sm">Selecciona un viaje</div></div>}
      </div>

      {/* Tabla de viajes */}
      <div className="xl:col-span-5 card">
        <div className="card-header">
          <h6 className="card-title">Historial de viajes</h6>
          <span className="text-xs text-default-400">elige una fila</span>
        </div>
        <div className="min-h-[342px]">
          <table className="min-w-full divide-y divide-default-200">
            <thead className="bg-default-150 sticky top-0 z-10">
              <tr className="text-default-600">
                <th className="px-4 py-2.5 text-start text-xs font-medium">Fecha</th>
                <th className="px-3 py-2.5 text-end text-xs font-medium">Dur.</th>
                <th className="px-3 py-2.5 text-end text-xs font-medium">Km</th>
                <th className="px-3 py-2.5 text-end text-xs font-medium">Score</th>
                <th className="px-4 py-2.5 text-start text-xs font-medium">Eventos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default-200 text-default-800 text-sm">
              {shown.map(trip => {
                const minutes = Math.round((new Date(trip.endTime).getTime() - new Date(trip.startTime).getTime()) / 60000);
                const active = trip.id === selectedTripId;
                const d = new Date(trip.startTime);
                return (
                  <tr
                    key={trip.id}
                    onClick={() => onSelect(trip.id)}
                    aria-selected={active}
                    className={`cursor-pointer transition-colors ${active ? 'bg-primary/5 border-s-2 border-s-primary' : 'hover:bg-default-50 border-s-2 border-s-transparent'}`}>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="font-medium text-default-800">{d.toLocaleDateString('es-PE', {day: '2-digit', month: 'short'})}</div>
                      <div className="text-xs text-default-400 font-mono">{d.toLocaleTimeString('es-PE', {hour: '2-digit', minute: '2-digit'})}{!trip.withinShift && <span className="ms-1 text-amber-600">· fuera de turno</span>}</div>
                    </td>
                    <td className="px-3 py-2.5 text-end whitespace-nowrap font-mono text-default-600">{minutes}′</td>
                    <td className="px-3 py-2.5 text-end whitespace-nowrap font-mono text-default-600">{trip.distance.toFixed(1)}</td>
                    <td className="px-3 py-2.5 text-end"><span className={`font-mono font-bold ${scoreColor(trip.score)}`}>{trip.score}</span></td>
                    <td className="px-4 py-2.5">
                      {trip.events.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-success"><LuBadgeCheck className="size-3.5" /> limpio</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {trip.events.map((ev, i) => (
                            <span
                              key={i}
                              title={EVENT_LABEL[ev.type] ?? ev.type}
                              className="inline-flex items-center gap-1 rounded bg-default-100 border border-default-200 px-1.5 py-0.5 text-[11px] font-mono text-default-700 whitespace-nowrap">
                              <span className="size-2 rounded-full shrink-0" style={{background: EVENT_COLOR[ev.type] ?? '#64748B'}} />
                              {severityText(ev.type, ev.severity)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-default-200 px-4 py-3 flex flex-col gap-3">
          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-1">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={current === 0}
                aria-label="Página anterior"
                className="btn btn-icon size-8 text-default-500 hover:text-primary disabled:opacity-30">
                <LuChevronLeft className="size-4" />
              </button>
              {Array.from({length: pageCount}).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPage(i)}
                  aria-current={i === current}
                  className={`size-8 rounded text-sm font-medium transition-colors ${
                    i === current ? 'bg-primary text-white' : 'text-default-600 hover:bg-primary/10 hover:text-primary'
                  }`}>
                  {i + 1}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                disabled={current === pageCount - 1}
                aria-label="Página siguiente"
                className="btn btn-icon size-8 text-default-500 hover:text-primary disabled:opacity-30">
                <LuChevronRight className="size-4" />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-sm text-default-500">{driver.trips.length} viaje{driver.trips.length !== 1 ? 's' : ''}</p>
            <p className="text-sm text-default-400 font-mono">{totalKm.toFixed(1)} km</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Horario ────────────────────────────────────────────────────────────
function ScheduleTab({schedule}: {schedule: ScheduleBlock[]}) {
  if (schedule.length === 0) {
    return (
      <div className="text-center py-14">
        <div className="size-12 rounded-full bg-default-100 text-default-400 grid place-items-center mx-auto mb-3"><LuClock className="size-6" /></div>
        <p className="text-default-600 font-medium">Sin horario configurado</p>
        <p className="text-default-400 text-sm mt-1">Este conductor no tiene turnos asignados.</p>
      </div>
    );
  }

  const HOURS = [0, 6, 12, 18, 24];

  return (
    <div className="flex flex-col gap-4">
      {/* Regla de horas (00–24) */}
      <div className="flex items-center gap-3 pl-[4.5rem] pr-2">
        <div className="relative flex-grow h-4">
          {HOURS.map(h => (
            <span key={h} className="absolute -translate-x-1/2 text-[11px] text-default-400 font-mono" style={{left: `${(h / 24) * 100}%`}}>
              {String(h).padStart(2, '0')}h
            </span>
          ))}
        </div>
      </div>

      <ul className="flex flex-col divide-y divide-default-100">
        {WEEK.map(({day, label, long}) => {
          const {work, rest} = blocksForDay(schedule, day);
          return (
            <li key={day} className="flex items-center gap-3 py-2.5">
              <span className="w-[4.5rem] shrink-0 text-sm font-medium text-default-700" title={long}>{label}</span>
              <div className="relative flex-grow h-9 rounded bg-default-100 border border-default-200 overflow-hidden">
                {/* Líneas guía cada 6h */}
                {[6, 12, 18].map(h => (
                  <span key={h} className="absolute top-0 bottom-0 w-px bg-default-200" style={{left: `${(h / 24) * 100}%`}} />
                ))}
                {work && (
                  <>
                    {/* Bloque de trabajo */}
                    <div
                      className="absolute top-0 bottom-0 bg-primary/80 rounded-sm"
                      style={{left: `${(work.startMin / DAY_MIN) * 100}%`, width: `${((work.endMin - work.startMin) / DAY_MIN) * 100}%`}}
                    />
                    {/* Hueco de descanso (se superpone sobre el bloque) */}
                    {rest && (
                      <div
                        className="absolute top-0 bottom-0 bg-card border-x border-amber-400/70"
                        style={{left: `${(rest.startMin / DAY_MIN) * 100}%`, width: `${((rest.endMin - rest.startMin) / DAY_MIN) * 100}%`, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(224,146,42,0.18) 4px, rgba(224,146,42,0.18) 8px)'}}
                      />
                    )}
                  </>
                )}
              </div>
              <span className="w-56 shrink-0 text-end text-sm">
                {work ? (
                  <span className="font-mono text-default-700">
                    {minToHHMM(work.startMin)}–{minToHHMM(work.endMin)}
                    {rest && <span className="text-default-400 font-sans"> · desc. {minToHHMM(rest.startMin)}–{minToHHMM(rest.endMin)}</span>}
                  </span>
                ) : (
                  <span className="text-default-300">libre</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Leyenda */}
      <div className="flex items-center gap-5 pt-3 mt-1 border-t border-default-200">
        <span className="inline-flex items-center gap-1.5 text-xs text-default-600"><span className="size-2.5 rounded-sm bg-primary/80" /> Turno laboral</span>
        <span className="inline-flex items-center gap-1.5 text-xs text-default-600"><span className="size-2.5 rounded-sm border border-amber-400/70" style={{backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(224,146,42,0.25) 2px, rgba(224,146,42,0.25) 4px)'}} /> Descanso</span>
      </div>
    </div>
  );
}

// ── Tab: Vehículo ───────────────────────────────────────────────────────────
function VehicleTab({driver}: {driver: DriverDetailType}) {
  const {vehicle} = driver;
  const person: Array<{Icon: IconType; label: string; value: string | null}> = [
    {Icon: LuPhone, label: 'Teléfono', value: driver.phone},
    {Icon: LuIdCard, label: 'DNI', value: driver.dni},
    {Icon: LuBadgeCheck, label: 'Licencia', value: driver.license},
  ].filter(p => p.value) as Array<{Icon: IconType; label: string; value: string | null}>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Vehículo */}
      <div className="lg:col-span-2">
        {vehicle ? (
          <div className="rounded border border-default-200 bg-default-50 p-6">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <div>
                <p className="text-xs text-default-400 mb-1.5 uppercase tracking-wide">Placa</p>
                <span className="inline-block font-mono text-3xl font-bold tracking-wider text-default-800 bg-card border border-default-300 rounded-md px-4 py-2 shadow-sm">
                  {vehicle.plate}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="size-12 rounded-full bg-primary/10 text-primary grid place-items-center"><LuCar className="size-6" /></span>
                <div>
                  <p className="text-xs text-default-400 uppercase tracking-wide">Tipo</p>
                  <p className="font-semibold text-default-800 text-lg">{VEHICLE_LABEL[vehicle.type] ?? vehicle.type}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-default-200">
              <div>
                <p className="text-xs text-default-400 uppercase tracking-wide mb-1">Marca</p>
                <p className="font-medium text-default-800">{vehicle.brand || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-default-400 uppercase tracking-wide mb-1">Modelo</p>
                <p className="font-medium text-default-800">{vehicle.model || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-default-400 uppercase tracking-wide mb-1">Año</p>
                <p className="font-medium text-default-800 font-mono">{vehicle.year || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-default-400 uppercase tracking-wide mb-1">Antigüedad</p>
                <p className="font-medium text-default-800">
                  {vehicle.year ? `${Math.max(0, new Date().getFullYear() - vehicle.year)} años` : '—'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded border border-default-200 bg-default-50 p-10 text-center">
            <div className="size-12 rounded-full bg-default-100 text-default-400 grid place-items-center mx-auto mb-3"><LuCar className="size-6" /></div>
            <p className="text-default-600 font-medium">Sin vehículo asignado</p>
            <p className="text-default-400 text-sm mt-1">Asigna un vehículo a este conductor desde su ficha.</p>
          </div>
        )}
      </div>

      {/* Datos del conductor */}
      <div className="rounded border border-default-200 p-5">
        <h6 className="card-title mb-4">Datos del conductor</h6>
        {person.length === 0 ? (
          <p className="text-default-400 text-sm">Sin datos de contacto registrados.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-default-200">
            {person.map(p => (
              <li key={p.label} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="size-9 rounded bg-default-100 text-default-500 grid place-items-center shrink-0"><p.Icon className="size-4.5" /></span>
                <div className="min-w-0">
                  <p className="text-xs text-default-400">{p.label}</p>
                  <p className="font-medium text-default-800 font-mono truncate">{p.value}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
