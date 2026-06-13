import {useCallback, useEffect, useMemo, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {LuArrowRight, LuTrophy, LuMedal, LuAward, LuUsers, LuGauge, LuBadgeCheck, LuChartNoAxesColumn} from 'react-icons/lu';
import {api, type RankingEntry} from '@/api/client';
import {getAdmin} from '@/auth';
import {getSocket} from '@/api/socket';
import MonthPicker from '@/components/MonthPicker';

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}
function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();
}
function scoreColor(score: number): string {
  if (score >= 90) return 'text-success';
  if (score >= 80) return 'text-amber-600';
  return 'text-danger';
}
function barColor(score: number): string {
  if (score >= 90) return 'bg-success';
  if (score >= 80) return 'bg-amber-500';
  return 'bg-danger';
}
function performance(score: number) {
  if (score >= 90) return <span className="font-medium text-success">Excelente</span>;
  if (score >= 80) return <span className="font-medium text-amber-600">Bueno</span>;
  return <span className="font-medium text-danger">Necesita mejorar</span>;
}
function bonusBadge(level: 1 | 2 | null, hasScore: boolean) {
  if (level === 2) return <span className="inline-flex items-center py-0.5 px-2.5 rounded text-xs font-medium bg-success/10 text-success border border-success/30">Bono nivel 2</span>;
  if (level === 1) return <span className="inline-flex items-center py-0.5 px-2.5 rounded text-xs font-medium bg-amber-500/10 text-amber-600 border border-amber-500/30">Bono nivel 1</span>;
  if (hasScore) return <span className="inline-flex items-center py-0.5 px-2.5 rounded text-xs font-medium bg-default-100 text-default-500 border border-default-200">Sin bono</span>;
  return <span className="text-default-400">—</span>;
}

// Tratamiento visual del podio por posición (#1 oro, #2 plata, #3 bronce).
// En orden 1-2-3 (sin alzar al primero); el #1 se distingue por el borde dorado.
const PODIUM = [
  {Icon: LuTrophy, ring: 'ring-amber-400/70', avatar: 'bg-amber-500/15 text-amber-600', badge: 'bg-amber-500 text-white'},
  {Icon: LuMedal, ring: 'ring-default-300/70', avatar: 'bg-default-200 text-default-600', badge: 'bg-default-400 text-white'},
  {Icon: LuAward, ring: 'ring-amber-700/40', avatar: 'bg-amber-700/15 text-amber-800', badge: 'bg-amber-700 text-white'},
];

function PodiumCard({entry, rank}: {entry: RankingEntry; rank: number}) {
  const p = PODIUM[rank];
  return (
    <div className={`card flex-1 ${rank === 0 ? 'ring-1 ring-amber-400/40' : ''}`}>
      <div className="card-body p-5 text-center relative">
        <span className={`absolute top-3 start-3 inline-flex items-center justify-center size-7 rounded-full text-xs font-bold font-mono ${p.badge}`}>
          {rank + 1}
        </span>
        <span className={`absolute top-3 end-3 ${rank === 0 ? 'text-amber-500' : rank === 1 ? 'text-default-400' : 'text-amber-700'}`}>
          <p.Icon className="size-5" />
        </span>
        <Link to={`/drivers/${entry.driverId}`} className="block">
          <span className={`size-16 rounded-full grid place-items-center text-lg font-bold mx-auto mb-3 ring-2 ${p.ring} ${p.avatar}`}>
            {initials(entry.name)}
          </span>
          <h6 className="font-semibold text-default-800 truncate hover:text-primary">{entry.name}</h6>
        </Link>
        <p className="text-xs text-default-500 font-mono mb-3">{entry.code}</p>
        {entry.score !== null ? (
          <>
            <div className={`text-4xl font-bold font-mono ${scoreColor(entry.score)}`}>{entry.score}</div>
            <div className="mt-3">{bonusBadge(entry.bonusLevel, true)}</div>
          </>
        ) : (
          <div className="text-default-400 text-sm py-3">sin viajes</div>
        )}
        <div className="grid grid-cols-3 gap-1 mt-4 pt-4 border-t border-default-200 text-center">
          <div><div className="font-mono font-semibold text-default-800">{entry.trips}</div><div className="text-[11px] text-default-400">viajes</div></div>
          <div><div className="font-mono font-semibold text-default-800">{entry.totalKm}</div><div className="text-[11px] text-default-400">km</div></div>
          <div><div className="font-mono font-semibold text-default-800">{entry.eventRate ?? '—'}</div><div className="text-[11px] text-default-400">/100km</div></div>
        </div>
      </div>
    </div>
  );
}

function FleetStat({Icon, tone, value, label}: {Icon: typeof LuUsers; tone: string; value: React.ReactNode; label: string}) {
  return (
    <div className="card">
      <div className="card-body p-4 flex items-center gap-3">
        <span className={`size-11 rounded grid place-items-center shrink-0 ${tone}`}><Icon className="size-5" /></span>
        <div className="min-w-0">
          <div className="text-2xl font-bold font-mono leading-none">{value}</div>
          <div className="text-xs text-default-500 mt-1 truncate">{label}</div>
        </div>
      </div>
    </div>
  );
}

export default function Rankings() {
  const [period, setPeriod] = useState(currentPeriod());
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    const {data} = await api.get('/api/admin/scores', {params: {period}});
    setRanking(data.ranking);
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const admin = getAdmin();
    if (!admin) return;
    const socket = getSocket(admin.companyId);
    socket.on('trip_synced', load);
    return () => { socket.off('trip_synced', load); };
  }, [load]);

  // El ranking ya llega ordenado por score desc del servidor; lo respetamos.
  const scored = useMemo(() => ranking.filter(r => r.score !== null), [ranking]);
  const podium = ranking.slice(0, 3);
  const rest = ranking.slice(3);
  const fleetAvg = useMemo(() => {
    if (scored.length === 0) return null;
    return Math.round(scored.reduce((s, r) => s + (r.score ?? 0), 0) / scored.length);
  }, [scored]);
  const withBonus = useMemo(() => ranking.filter(r => r.bonusLevel !== null).length, [ranking]);
  const totalTrips = useMemo(() => ranking.reduce((s, r) => s + r.trips, 0), [ranking]);

  if (loading) {
    return (
      <div className="card">
        <div className="card-header gap-4">
          <div><h6 className="card-title">Ranking del período</h6></div>
          <MonthPicker value={period} onChange={setPeriod} />
        </div>
        <div className="card-body">
          <div className="flex flex-col gap-3" aria-busy="true">
            {Array.from({length: 5}).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded border border-default-200 animate-pulse">
                <span className="size-10 rounded-full bg-default-150" />
                <div className="flex-grow space-y-2"><div className="h-3 w-40 bg-default-150 rounded" /><div className="h-2.5 w-20 bg-default-150 rounded" /></div>
                <div className="h-3 w-12 bg-default-150 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const empty = ranking.length === 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Cabecera + selector de período */}
      <div className="card">
        <div className="card-header gap-4">
          <div className="min-w-0">
            <h6 className="card-title">Ranking del período</h6>
            <p className="text-sm text-default-500 mt-0.5 truncate">se actualiza solo cuando llegan viajes nuevos</p>
          </div>
          <div className="shrink-0"><MonthPicker value={period} onChange={setPeriod} /></div>
        </div>

        {/* Mini-stats de flota */}
        {!empty && (
          <div className="card-body border-t border-default-200">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <FleetStat Icon={LuUsers} tone="bg-primary/10 text-primary" value={ranking.length} label="conductores" />
              <FleetStat Icon={LuGauge} tone={fleetAvg !== null && fleetAvg >= 90 ? 'bg-success/15 text-success' : fleetAvg !== null && fleetAvg >= 80 ? 'bg-amber-500/15 text-amber-600' : 'bg-danger/10 text-danger'} value={fleetAvg ?? '—'} label="score promedio" />
              <FleetStat Icon={LuBadgeCheck} tone="bg-success/15 text-success" value={withBonus} label="con bono" />
              <FleetStat Icon={LuChartNoAxesColumn} tone="bg-default-100 text-default-600" value={totalTrips} label="viajes del período" />
            </div>
          </div>
        )}
      </div>

      {empty ? (
        <div className="card">
          <div className="card-body">
            <div className="text-center py-14">
              <div className="size-14 rounded-full bg-primary/10 text-primary grid place-items-center mx-auto mb-4"><LuTrophy className="size-7" /></div>
              <p className="text-default-700 font-medium">Aún no hay datos del período</p>
              <p className="text-default-400 text-sm mt-1">El ranking aparecerá cuando los conductores sincronicen viajes.</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Podio top 3 */}
          {podium.length > 0 && (
            <div className="flex flex-col sm:flex-row items-stretch gap-4">
              {podium.map((e, i) => <PodiumCard key={e.driverId} entry={e} rank={i} />)}
            </div>
          )}

          {/* Resto del ranking */}
          {rest.length > 0 && (
            <div className="card">
              <div className="card-header"><h6 className="card-title">Resto de la flota</h6><span className="text-sm text-default-500">ordenado por score</span></div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-default-200">
                  <thead className="bg-default-150">
                    <tr className="text-default-600">
                      <th className="px-4 py-3 text-start text-sm font-medium">#</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">Conductor</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">Score</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">Rendimiento</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">Bono</th>
                      <th className="px-4 py-3 text-end text-sm font-medium">Viajes</th>
                      <th className="px-4 py-3 text-end text-sm font-medium">Km</th>
                      <th className="px-4 py-3 text-end text-sm font-medium">Eventos</th>
                      <th className="px-4 py-3 text-end text-sm font-medium">/100 km</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default-200 text-default-800 text-sm">
                    {rest.map((e, i) => (
                      <tr key={e.driverId} className="hover:bg-default-50">
                        <td className="px-4 py-3 font-mono font-semibold text-default-400">{String(i + 4).padStart(2, '0')}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="size-10 rounded-full grid place-items-center text-xs font-bold shrink-0 bg-primary/10 text-primary">
                              {initials(e.name)}
                            </span>
                            <div className="min-w-0">
                              <h6 className="font-semibold mb-0.5 truncate"><Link to={`/drivers/${e.driverId}`} className="hover:text-primary">{e.name}</Link></h6>
                              <p className="text-default-500 text-xs font-mono">{e.code}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {e.score !== null ? (
                            <div className="w-32">
                              <span className={`font-mono font-bold ${scoreColor(e.score)}`}>{e.score}</span>
                              <div className="w-full bg-default-200 rounded-full h-1.5 mt-1">
                                <div className={`h-1.5 rounded-full ${barColor(e.score)}`} style={{width: `${Math.min(100, e.score)}%`, transition: 'width .6s ease'}} />
                              </div>
                            </div>
                          ) : <span className="text-default-400">sin viajes</span>}
                        </td>
                        <td className="px-4 py-3">{e.score !== null ? performance(e.score) : <span className="text-default-400">—</span>}</td>
                        <td className="px-4 py-3">{bonusBadge(e.bonusLevel, e.score !== null)}</td>
                        <td className="px-4 py-3 text-end font-mono">{e.trips}</td>
                        <td className="px-4 py-3 text-end font-mono">{e.totalKm}</td>
                        <td className="px-4 py-3 text-end font-mono">{e.events}</td>
                        <td className="px-4 py-3 text-end font-mono font-medium">{e.eventRate ?? <span className="text-default-400">—</span>}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => navigate(`/drivers/${e.driverId}`)}
                            className="btn btn-icon bg-default-100 hover:bg-primary/10 text-default-600 hover:text-primary"
                            aria-label={`Ver detalle de ${e.name}`}>
                            <LuArrowRight className="size-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card-footer">
                <p className="text-sm text-default-500">
                  {ranking.length} conductor{ranking.length !== 1 ? 'es' : ''} · {withBonus} con bono este período
                </p>
                <p className="text-sm text-default-400 font-mono">{period}</p>
              </div>
            </div>
          )}

          {rest.length === 0 && (
            <div className="card"><div className="card-footer">
              <p className="text-sm text-default-500">{ranking.length} conductor{ranking.length !== 1 ? 'es' : ''} · {withBonus} con bono este período</p>
              <p className="text-sm text-default-400 font-mono">{period}</p>
            </div></div>
          )}
        </>
      )}
    </div>
  );
}
