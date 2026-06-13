import {type ReactNode, useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import Chart from 'react-apexcharts';
import type {ApexOptions} from 'apexcharts';
import {LuShield, LuGauge, LuRoute, LuTriangleAlert, LuTrendingUp, LuTrendingDown, LuArrowRight} from 'react-icons/lu';
import type {IconType} from 'react-icons';
import {api} from '@/api/client';
import {getAdmin} from '@/auth';
import {useTheme} from '@/useTheme';

type Trends = {fleetScore: number | null; eventRate: number | null; trips: number | null; severeAlerts: number | null};
type Summary = {
  windowDays: number;
  fleetScore: number | null;
  totalTrips: number;
  totalKm: number;
  totalEvents: number;
  severeAlerts: number;
  eventRate: number;
  activeDrivers: number;
  totalDrivers: number;
  driversWithBonus: number;
  trends: Trends;
  eventsPerDay: Array<{date: string; count: number; severe: number}>;
  eventsByType: Array<{type: string; count: number}>;
  eventsByHour: Array<{label: string; hint: string; count: number}>;
  topDrivers: Array<{driverId: string; name: string; score: number; trips: number; eventRate: number}>;
  watchlist: Array<{driverId: string; name: string; score: number; trips: number; eventRate: number}>;
};

const EVENT_LABEL: Record<string, string> = {
  HARD_BRAKE: 'Frenadas', HARSH_ACCEL: 'Aceleraciones', SHARP_TURN: 'Giros', SPEEDING: 'Velocidad',
};
const EVENT_COLOR: Record<string, string> = {
  HARD_BRAKE: '#ef4444', HARSH_ACCEL: '#f59e0b', SHARP_TURN: '#3b82f6', SPEEDING: '#22c55e',
};

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();
}
function scoreColor(score: number): string {
  if (score >= 90) return 'text-success';
  if (score >= 80) return 'text-amber-600';
  return 'text-danger';
}

const ICON_TONE: Record<string, string> = {
  blue: 'bg-primary/10 text-primary',
  green: 'bg-success/15 text-success',
  amber: 'bg-amber-500/15 text-amber-600',
  red: 'bg-danger/10 text-danger',
};

/**
 * KPI card con tendencia vs período anterior. `goodWhenUp` decide el color de
 * la flecha: para el score, subir es bueno; para alertas/tasa, bajar es bueno.
 */
function Kpi({tone, Icon, label, value, valueClass, trend, goodWhenUp, ctx}: {
  tone: keyof typeof ICON_TONE; Icon: IconType; label: string; value: ReactNode; valueClass?: string;
  trend: number | null; goodWhenUp: boolean; ctx: ReactNode;
}) {
  const up = trend !== null && trend > 0;
  const flat = trend === null || trend === 0;
  const good = trend !== null && (up === goodWhenUp);
  return (
    <div className="card">
      <div className="card-body p-5">
        <div className="flex items-start justify-between">
          <span className={`size-11 rounded grid place-items-center ${ICON_TONE[tone]}`}><Icon className="size-5.5" /></span>
          {!flat && (
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded ${good ? 'text-success bg-success/10' : 'text-danger bg-danger/10'}`}>
              {up ? <LuTrendingUp className="size-3.5" /> : <LuTrendingDown className="size-3.5" />}
              {Math.abs(trend!)}%
            </span>
          )}
        </div>
        <h3 className={`text-3xl font-bold mt-4 ${valueClass ?? ''}`}>{value}</h3>
        <p className="text-sm text-default-500 mt-0.5">{label}</p>
        <p className="text-xs text-default-400 mt-3 pt-3 border-t border-default-200">{ctx}</p>
      </div>
    </div>
  );
}

export default function Resumen() {
  const [s, setS] = useState<Summary | null>(null);
  const admin = getAdmin();
  const {theme} = useTheme();
  const dark = theme === 'dark';

  useEffect(() => {
    api.get('/api/admin/summary').then(({data}) => setS(data));
  }, []);

  if (!s) {
    return <div className="card"><div className="card-body"><p className="text-default-500">Cargando métricas…</p></div></div>;
  }

  const baseChart = (extra: ApexOptions): ApexOptions => ({
    chart: {toolbar: {show: false}, fontFamily: 'DM Sans, sans-serif', foreColor: dark ? '#a1a1aa' : '#71717a'},
    grid: {borderColor: dark ? '#3f3f46' : '#e4e4e7', strokeDashArray: 4, padding: {top: 0, right: 8}},
    dataLabels: {enabled: false},
    tooltip: {theme: dark ? 'dark' : 'light'},
    ...extra,
  });

  const areaOptions = baseChart({
    colors: ['#3b82f6', '#ef4444'],
    stroke: {curve: 'smooth', width: [2.5, 2]},
    fill: {type: 'gradient', gradient: {opacityFrom: 0.2, opacityTo: 0.02}},
    legend: {position: 'top', horizontalAlign: 'right', fontSize: '13px'},
    xaxis: {categories: s.eventsPerDay.map(d => d.date.slice(5).replace('-', '/')), axisBorder: {show: false}, axisTicks: {show: false}, labels: {style: {fontSize: '11px'}}},
    yaxis: {labels: {style: {fontSize: '11px'}}, forceNiceScale: true},
  });

  const donutOptions: ApexOptions = {
    chart: {fontFamily: 'DM Sans, sans-serif'},
    labels: s.eventsByType.map(e => EVENT_LABEL[e.type] ?? e.type),
    colors: s.eventsByType.map(e => EVENT_COLOR[e.type] ?? '#71717a'),
    legend: {position: 'bottom', fontSize: '13px', labels: {colors: dark ? '#a1a1aa' : '#71717a'}},
    stroke: {colors: [dark ? '#1c1c21' : '#fff'], width: 3},
    dataLabels: {enabled: false},
    tooltip: {theme: dark ? 'dark' : 'light'},
    plotOptions: {pie: {donut: {size: '70%', labels: {show: true, total: {show: true, label: 'eventos', fontSize: '12px', color: dark ? '#a1a1aa' : '#71717a', formatter: () => String(s.totalEvents)}, value: {fontSize: '24px', fontWeight: 700, color: dark ? '#e8e8ea' : '#27272a'}}}}},
  };

  const hourOptions = baseChart({
    chart: {type: 'bar', toolbar: {show: false}, fontFamily: 'DM Sans, sans-serif', foreColor: dark ? '#a1a1aa' : '#71717a'},
    colors: ['#94a3b8', '#22c55e', '#f59e0b', '#6366f1'], // madrugada/mañana/tarde/noche
    plotOptions: {bar: {borderRadius: 4, columnWidth: '45%', distributed: true}},
    legend: {show: false},
    xaxis: {categories: s.eventsByHour.map(h => h.label), axisBorder: {show: false}, axisTicks: {show: false}, labels: {style: {fontSize: '11px'}}},
  });

  return (
    <>
      {/* Welcome strip */}
      <div className="card overflow-hidden mb-5 border-0">
        <div className="card-body flex flex-wrap items-center justify-between gap-6 relative" style={{background: 'linear-gradient(110deg, #1e293b 0%, #0f172a 100%)'}}>
          <div className="absolute -end-12 top-1/2 -translate-y-1/2 size-56 rounded-full pointer-events-none" style={{background: 'radial-gradient(circle, rgba(59,130,246,0.35), transparent 70%)'}} />
          <div className="relative z-10">
            <h2 className="text-xl font-bold text-white">¡Hola, {admin?.name?.split(' ')[0] ?? 'Admin'}! 👋</h2>
            <p className="text-sm text-slate-400 mt-1.5 max-w-xl">
              Resumen de tu flota en los últimos {s.windowDays} días, comparado con el período anterior. Los conductores con score 80+ reciben bono automático.
            </p>
          </div>
          <div className="flex gap-7 relative z-10">
            {[[s.fleetScore ?? '—', 'score flota'], [s.activeDrivers, 'activos'], [s.severeAlerts, 'alertas']].map(([v, l]) => (
              <div key={l as string} className="text-center"><div className="text-2xl font-bold text-white">{v}</div><div className="text-xs text-slate-400">{l}</div></div>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs con tendencia */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-5">
        <Kpi tone={s.fleetScore !== null && s.fleetScore >= 90 ? 'green' : s.fleetScore !== null && s.fleetScore >= 80 ? 'amber' : 'red'}
          Icon={LuShield} label="Score de flota" value={s.fleetScore ?? '—'} valueClass={s.fleetScore !== null ? scoreColor(s.fleetScore) : ''}
          trend={s.trends.fleetScore} goodWhenUp ctx="promedio de la flota · vs mes anterior" />
        <Kpi tone="blue" Icon={LuGauge} label="Eventos por 100 km" value={s.eventRate}
          trend={s.trends.eventRate} goodWhenUp={false} ctx="tasa normalizada · menos es mejor" />
        <Kpi tone="green" Icon={LuRoute} label="Viajes registrados" value={s.totalTrips}
          trend={s.trends.trips} goodWhenUp ctx={`${s.activeDrivers} conductores · ${s.totalKm.toLocaleString('es-PE')} km`} />
        <Kpi tone="red" Icon={LuTriangleAlert} label="Alertas severas" value={s.severeAlerts} valueClass="text-danger"
          trend={s.trends.severeAlerts} goodWhenUp={false} ctx={<Link to="/alerts" className="text-primary">ver feed de alertas →</Link>} />
      </div>

      {/* Chart eventos por día + distribución por tipo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <div className="card lg:col-span-2">
          <div className="card-header"><h6 className="card-title">Eventos de riesgo por día</h6><span className="text-sm text-default-500">últimos 14 días</span></div>
          <div className="card-body">
            <Chart type="area" height={280} options={areaOptions} series={[
              {name: 'Total eventos', data: s.eventsPerDay.map(d => d.count)},
              {name: 'Severos', data: s.eventsPerDay.map(d => d.severe)},
            ]} />
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h6 className="card-title">Por tipo de evento</h6></div>
          <div className="card-body">
            {s.eventsByType.length > 0
              ? <Chart type="donut" height={290} options={donutOptions} series={s.eventsByType.map(e => e.count)} />
              : <p className="text-default-500 text-sm py-10 text-center">Sin eventos en la ventana.</p>}
          </div>
        </div>
      </div>

      {/* Watchlist + franja horaria */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card lg:col-span-2">
          <div className="card-header">
            <div><h6 className="card-title">Conductores que necesitan atención</h6><p className="text-sm text-default-500 mt-0.5 truncate">score por debajo de 80 — candidatos a capacitación</p></div>
            <Link to="/rankings" className="text-sm text-primary shrink-0">ranking →</Link>
          </div>
          <div className="card-body">
            {s.watchlist.length === 0 ? (
              <div className="text-center py-8">
                <div className="size-12 rounded-full bg-success/10 text-success grid place-items-center mx-auto mb-3"><LuShield className="size-6" /></div>
                <p className="text-default-600 font-medium">Toda la flota por encima de 80</p>
                <p className="text-default-400 text-sm">Ningún conductor necesita atención este período.</p>
              </div>
            ) : (
              <ul className="flex flex-col">
                {s.watchlist.map(d => (
                  <li key={d.driverId} className="flex items-center gap-3 py-3 border-b border-default-200 last:border-0">
                    <span className="size-10 rounded-full bg-danger/10 text-danger grid place-items-center text-xs font-bold">{initials(d.name)}</span>
                    <div className="flex-grow min-w-0">
                      <Link to={`/drivers/${d.driverId}`} className="font-semibold text-default-800 hover:text-primary text-sm">{d.name}</Link>
                      <p className="text-xs text-default-500">{d.trips} viajes · {d.eventRate} eventos/100km</p>
                    </div>
                    <span className="font-bold text-danger text-lg">{d.score}</span>
                    <Link to={`/drivers/${d.driverId}`} className="btn btn-icon bg-default-100 hover:bg-primary/10 text-default-600 hover:text-primary"><LuArrowRight className="size-4" /></Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h6 className="card-title">Eventos por franja horaria</h6></div>
          <div className="card-body">
            <Chart type="bar" height={250} options={hourOptions} series={[{name: 'Eventos', data: s.eventsByHour.map(h => h.count)}]} />
            <p className="text-xs text-default-400 text-center mt-2">¿Cuándo ocurren los eventos de riesgo?</p>
          </div>
        </div>
      </div>
    </>
  );
}
