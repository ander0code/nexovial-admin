import {useEffect, useMemo, useState} from 'react';
import {Link, useParams, useSearchParams} from 'react-router-dom';
import {
  LuChevronLeft, LuChevronRight, LuCar, LuCalendarClock, LuRoute, LuShield, LuMapPin,
  LuTriangleAlert, LuPhone, LuIdCard, LuBadgeCheck, LuClock, LuUserRound,
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

  // Misma plantilla de columnas para la regla de horas Y cada fila de día, de modo
  // que la pista (col 2) quede perfectamente alineada: las marcas 00h–24h viven
  // SOLO sobre la pista y nunca pisan el día (col 1) ni el rango horario (col 3).
  // [ día · pista flexible · rango horario auto ]
  // Anchos FIJOS en col 1 (día) y col 3 (rango horario) → la col 2 (el riel 0h–24h)
  // queda idéntica en la fila del eje Y en cada fila de día. Solo así las marcas de
  // hora y las barras comparten exactamente la misma escala y todo se alinea.
  const gridCols = '3.5rem minmax(0, 1fr) 17rem';

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl bg-default-50 border border-default-200/70 p-5 sm:p-6 flex flex-col gap-4">
        {/* Regla de horas (00–24) — alineada con la pista vía la misma rejilla */}
        <div className="grid items-center gap-x-4" style={{gridTemplateColumns: gridCols}}>
          <span aria-hidden />
          <div className="relative h-4">
            {HOURS.map(h => (
              <span
                key={h}
                className="absolute top-0 text-[11px] text-default-400 font-mono tabular-nums"
                style={{left: `${(h / 24) * 100}%`, transform: h === 0 ? 'none' : h === 24 ? 'translateX(-100%)' : 'translateX(-50%)'}}>
                {String(h).padStart(2, '0')}h
              </span>
            ))}
          </div>
          <span aria-hidden />
        </div>

        <ul className="flex flex-col gap-1">
          {WEEK.map(({day, label, long}) => {
            const {work, rest} = blocksForDay(schedule, day);
            const isRestDay = !work;
            return (
              <li
                key={day}
                className={`grid items-center gap-x-4 py-2 rounded-xl transition-colors ${isRestDay ? '' : 'hover:bg-card'}`}
                style={{gridTemplateColumns: gridCols}}>
                {/* Col 1 — etiqueta del día */}
                <span className={`text-sm font-medium ${isRestDay ? 'text-default-400' : 'text-default-700'}`} title={long}>{label}</span>

                {/* Col 2 — pista 0h→24h: marcas, turno y descanso viven SOLO aquí */}
                <div className="relative h-8 rounded-full bg-default-100 overflow-hidden">
                  {/* Líneas guía cada 6h */}
                  {[6, 12, 18].map(h => (
                    <span key={h} className="absolute top-1.5 bottom-1.5 w-px bg-default-200/70" style={{left: `${(h / 24) * 100}%`}} />
                  ))}
                  {work && (
                    <>
                      {/* Bloque de trabajo — píldora redondeada, padding vertical para respirar */}
                      <div
                        className="absolute top-1 bottom-1 bg-primary/90 rounded-full shadow-sm"
                        style={{left: `${(work.startMin / DAY_MIN) * 100}%`, width: `${((work.endMin - work.startMin) / DAY_MIN) * 100}%`}}
                      />
                      {/* Descanso — pausa suave dentro del turno (ámbar tenue, no estridente) */}
                      {rest && (
                        <div
                          className="absolute top-1 bottom-1 bg-warning rounded-full ring-2 ring-default-100"
                          style={{left: `${(rest.startMin / DAY_MIN) * 100}%`, width: `${((rest.endMin - rest.startMin) / DAY_MIN) * 100}%`}}
                          title={`Descanso ${minToHHMM(rest.startMin)}–${minToHHMM(rest.endMin)}`}
                        />
                      )}
                    </>
                  )}
                </div>

                {/* Col 3 — rango horario: columna propia, jamás pisa la regla de horas */}
                <span className="text-end text-sm whitespace-nowrap">
                  {work ? (
                    <span className="font-mono tabular-nums text-default-700">
                      {minToHHMM(work.startMin)}–{minToHHMM(work.endMin)}
                      {rest && <span className="text-default-400"> · desc {minToHHMM(rest.startMin)}–{minToHHMM(rest.endMin)}</span>}
                    </span>
                  ) : (
                    <span className="text-default-400">libre</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-5 px-1">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-default-600"><span className="size-2.5 rounded-full bg-primary/90" /> Turno laboral</span>
        <span className="inline-flex items-center gap-2 text-xs font-medium text-default-600"><span className="size-2.5 rounded-full bg-warning" /> Descanso</span>
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

  const specs: Array<{label: string; value: string; mono?: boolean}> = vehicle ? [
    {label: 'Marca', value: vehicle.brand || '—'},
    {label: 'Modelo', value: vehicle.model || '—'},
    {label: 'Año', value: vehicle.year ? String(vehicle.year) : '—', mono: true},
    {label: 'Antigüedad', value: vehicle.year ? `${Math.max(0, new Date().getFullYear() - vehicle.year)} años` : '—'},
  ] : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
      {/* Vehículo */}
      <div className="lg:col-span-2 flex">
        {vehicle ? (
          <div className="flex-grow rounded-2xl border border-default-200 bg-default-50 p-6 flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-5">
              {/* Placa — motivo de matrícula real */}
              <div>
                <p className="label-tech text-[11px] text-default-400 mb-2">Placa</p>
                <span className="inline-flex items-center justify-center font-mono font-bold text-3xl tracking-wider tabular-nums text-default-800 bg-card border-2 border-default-300 rounded-xl px-5 py-2.5 shadow-sm">
                  {vehicle.plate}
                </span>
              </div>
              {/* Tipo — tile suave azul */}
              <div className="flex items-center gap-3">
                <span className="size-12 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0"><LuCar className="size-6" /></span>
                <div>
                  <p className="label-tech text-[11px] text-default-400 mb-1">Tipo</p>
                  <p className="font-semibold text-default-800 text-lg leading-none">{VEHICLE_LABEL[vehicle.type] ?? vehicle.type}</p>
                </div>
              </div>
            </div>

            {/* Ficha técnica */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-xl overflow-hidden bg-default-200 border border-default-200 mt-auto">
              {specs.map(s => (
                <div key={s.label} className="bg-default-50 px-4 py-3.5">
                  <p className="label-tech text-[11px] text-default-400 mb-1.5">{s.label}</p>
                  <p className={`font-semibold text-default-800 ${s.mono ? 'font-mono tabular-nums' : ''}`}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-grow rounded-2xl border border-default-200 bg-default-50 p-10 flex flex-col items-center justify-center text-center">
            <div className="size-14 rounded-full bg-default-100 text-default-400 grid place-items-center mb-3"><LuCar className="size-7" /></div>
            <p className="text-default-600 font-medium">Sin vehículo asignado</p>
            <p className="text-default-400 text-sm mt-1">Asigna un vehículo a este conductor desde su ficha.</p>
          </div>
        )}
      </div>

      {/* Datos del conductor */}
      <div className="rounded-2xl border border-default-200 p-6 flex flex-col">
        <h6 className="card-title mb-4">Datos del conductor</h6>
        {person.length === 0 ? (
          <div className="flex-grow flex flex-col items-center justify-center text-center py-6">
            <div className="size-14 rounded-full bg-default-100 text-default-400 grid place-items-center mb-3"><LuUserRound className="size-7" /></div>
            <p className="text-default-600 font-medium">Sin datos de contacto</p>
            <p className="text-default-400 text-sm mt-1 max-w-[14rem]">Aún no se registran teléfono, DNI ni licencia para este conductor.</p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-default-200">
            {person.map(p => (
              <li key={p.label} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
                <span className="size-9 rounded-xl bg-default-100 text-default-500 grid place-items-center shrink-0"><p.Icon className="size-4.5" /></span>
                <div className="min-w-0">
                  <p className="label-tech text-[11px] text-default-400 mb-0.5">{p.label}</p>
                  <p className="font-semibold text-default-800 font-mono tabular-nums truncate">{p.value}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
