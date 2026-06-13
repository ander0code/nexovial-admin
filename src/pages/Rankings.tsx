import {useCallback, useEffect, useMemo, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {LuArrowRight, LuTrophy, LuUsers, LuGauge, LuBadgeCheck, LuChartNoAxesColumn} from 'react-icons/lu';
import {api, type RankingEntry} from '@/api/client';
import {getAdmin} from '@/auth';
import {getSocket} from '@/api/socket';
import MonthPicker from '@/components/MonthPicker';
import ScoreRing from '@/components/ui/ScoreRing';

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}
function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();
}

// Chip de tier — texto neutro + un punto semántico diminuto (único color permitido
// fuera del ScoreRing). Sin fondos de color: nada de verde/ámbar/rojo rellenando.
function tierDot(score: number): string {
  if (score >= 90) return 'bg-success';
  if (score >= 80) return 'bg-primary';
  if (score >= 70) return 'bg-warning';
  return 'bg-danger';
}
function tierLabel(score: number): string {
  if (score >= 90) return 'Excelente';
  if (score >= 80) return 'Bueno';
  if (score >= 70) return 'Regular';
  return 'Necesita mejorar';
}
function TierChip({score}: {score: number}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-default-600">
      <span className={`size-1.5 rounded-full ${tierDot(score)}`} aria-hidden />
      {tierLabel(score)}
    </span>
  );
}

// Bono — píldoras neutras (un punto de color cuando aplica, nada más).
function bonusBadge(level: 1 | 2 | null, hasScore: boolean) {
  if (level === 2 || level === 1) {
    return (
      <span className="inline-flex items-center gap-1.5 py-0.5 px-2.5 rounded-full text-xs font-medium bg-default-100 text-default-700">
        <span className="size-1.5 rounded-full bg-success" aria-hidden />
        Bono nivel {level}
      </span>
    );
  }
  if (hasScore) return <span className="inline-flex items-center py-0.5 px-2.5 rounded-full text-xs font-medium bg-default-100 text-default-500">Sin bono</span>;
  return <span className="text-default-400">—</span>;
}

// Podio en orden 1-2-3. El #1 se distingue solo por jerarquía (ring más grande +
// realce sutil de marca), nunca por oro/plata/bronce. El color vive en el ScoreRing.
function PodiumCard({entry, rank}: {entry: RankingEntry; rank: number}) {
  const lead = rank === 0;
  // Mismo tamaño de dial en los 3 → tarjetas parejas (el #1 se realza con el borde
  // sutil, el trofeo y el badge "1", no con tamaño). h-auto anula el h-fit del .card
  // para que el contenedor flex items-stretch las deje a la MISMA altura.
  const ringSize = 84;
  return (
    <div className={`card flex-1 h-auto ${lead ? 'ring-1 ring-primary/15' : ''}`}>
      <div className="card-body p-6 text-center relative flex flex-col flex-1">
        <span className="absolute top-4 start-4 inline-flex items-center justify-center size-7 rounded-full text-xs font-bold font-mono tabular-nums bg-default-200 text-default-700">
          {rank + 1}
        </span>
        {lead && (
          <span className="absolute top-4 end-4 text-default-400" aria-hidden>
            <LuTrophy className="size-5" />
          </span>
        )}

        <Link to={`/drivers/${entry.driverId}`} className="block">
          <span className="size-14 rounded-full grid place-items-center text-base font-bold mx-auto mb-3 bg-default-200 text-default-700">
            {initials(entry.name)}
          </span>
          <h6 className="font-display font-bold text-default-800 truncate hover:text-primary transition-colors">{entry.name}</h6>
        </Link>
        <p className="text-xs text-default-400 font-mono tabular-nums mb-5">{entry.code}</p>

        {entry.score !== null ? (
          <>
            <ScoreRing score={entry.score} size={ringSize} showTier className="mx-auto" />
            <div className="mt-4">{bonusBadge(entry.bonusLevel, true)}</div>
          </>
        ) : (
          <div className="text-default-400 text-sm py-10">sin viajes</div>
        )}

        <div className="grid grid-cols-3 gap-2 mt-auto pt-6">
          <div>
            <div className="font-mono tabular-nums font-bold text-default-800">{entry.trips}</div>
            <div className="text-[11px] text-default-400 mt-0.5">viajes</div>
          </div>
          <div>
            <div className="font-mono tabular-nums font-bold text-default-800">{entry.totalKm}</div>
            <div className="text-[11px] text-default-400 mt-0.5">km</div>
          </div>
          <div>
            <div className="font-mono tabular-nums font-bold text-default-800">{entry.eventRate ?? '—'}</div>
            <div className="text-[11px] text-default-400 mt-0.5">/100km</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Mini-tiles de flota — UN solo tratamiento de ícono para los cuatro
// (neutro suave). Sin 4 tintes distintos.
function FleetStat({Icon, value, label}: {Icon: typeof LuUsers; value: React.ReactNode; label: string}) {
  return (
    <div className="rounded-2xl bg-default-100 p-4 flex items-center gap-3">
      <span className="size-11 rounded-xl grid place-items-center shrink-0 bg-default-200 text-default-500"><Icon className="size-5" /></span>
      <div className="min-w-0">
        <div className="num-hero text-2xl text-default-800 leading-none">{value}</div>
        <div className="text-xs text-default-500 mt-1.5 truncate">{label}</div>
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
              <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-default-100 animate-pulse">
                <span className="size-10 rounded-full bg-default-200" />
                <div className="flex-grow space-y-2"><div className="h-3 w-40 bg-default-200 rounded-full" /><div className="h-2.5 w-20 bg-default-200 rounded-full" /></div>
                <div className="h-3 w-12 bg-default-200 rounded-full" />
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
            <p className="text-sm text-default-500 mt-1 truncate">se actualiza solo cuando llegan viajes nuevos</p>
          </div>
          <div className="shrink-0"><MonthPicker value={period} onChange={setPeriod} /></div>
        </div>

        {/* Mini-stats de flota — un mismo tratamiento neutro para los cuatro */}
        {!empty && (
          <div className="card-body pt-3">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <FleetStat Icon={LuUsers} value={ranking.length} label="conductores" />
              <FleetStat Icon={LuGauge} value={fleetAvg ?? '—'} label="score promedio" />
              <FleetStat Icon={LuBadgeCheck} value={withBonus} label="con bono" />
              <FleetStat Icon={LuChartNoAxesColumn} value={totalTrips} label="viajes del período" />
            </div>
          </div>
        )}
      </div>

      {empty ? (
        <div className="card">
          <div className="card-body">
            <div className="text-center py-14">
              <div className="size-14 rounded-2xl bg-primary/10 text-primary grid place-items-center mx-auto mb-4"><LuTrophy className="size-7" /></div>
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

          {/* Resto de la flota */}
          {rest.length > 0 && (
            <div className="card">
              <div className="card-header"><h6 className="card-title">Resto de la flota</h6><span className="text-sm text-default-400">ordenado por score</span></div>
              <div className="card-body pt-3">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-y-1">
                    <thead>
                      <tr className="label-tech text-[11px] text-default-400">
                        <th className="px-4 py-2 text-start font-semibold">#</th>
                        <th className="px-4 py-2 text-start font-semibold">Conductor</th>
                        <th className="px-4 py-2 text-start font-semibold">Score</th>
                        <th className="px-4 py-2 text-start font-semibold">Rendimiento</th>
                        <th className="px-4 py-2 text-start font-semibold">Bono</th>
                        <th className="px-4 py-2 text-end font-semibold">Viajes</th>
                        <th className="px-4 py-2 text-end font-semibold">Km</th>
                        <th className="px-4 py-2 text-end font-semibold">Eventos</th>
                        <th className="px-4 py-2 text-end font-semibold">/100 km</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="text-default-800 text-sm">
                      {rest.map((e, i) => (
                        <tr key={e.driverId} className="bg-default-50 hover:bg-default-100 transition-colors [&>td:first-child]:rounded-s-xl [&>td:last-child]:rounded-e-xl">
                          <td className="px-4 py-3 font-mono tabular-nums font-semibold text-default-400">{String(i + 4).padStart(2, '0')}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="size-10 rounded-full grid place-items-center text-xs font-bold shrink-0 bg-default-200 text-default-700">
                                {initials(e.name)}
                              </span>
                              <div className="min-w-0">
                                <h6 className="font-semibold mb-0.5 truncate"><Link to={`/drivers/${e.driverId}`} className="hover:text-primary transition-colors">{e.name}</Link></h6>
                                <p className="text-default-400 text-xs font-mono tabular-nums">{e.code}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {e.score !== null ? (
                              <div className="flex items-center gap-3 w-36">
                                <span className="font-mono tabular-nums font-bold text-default-800 w-7 shrink-0">{e.score}</span>
                                <div className="w-full bg-default-200 rounded-full h-1.5 overflow-hidden">
                                  <div className="h-1.5 rounded-full bg-primary" style={{width: `${Math.min(100, e.score)}%`, transition: 'width .6s ease'}} />
                                </div>
                              </div>
                            ) : <span className="text-default-400">sin viajes</span>}
                          </td>
                          <td className="px-4 py-3">{e.score !== null ? <TierChip score={e.score} /> : <span className="text-default-400">—</span>}</td>
                          <td className="px-4 py-3">{bonusBadge(e.bonusLevel, e.score !== null)}</td>
                          <td className="px-4 py-3 text-end font-mono tabular-nums">{e.trips}</td>
                          <td className="px-4 py-3 text-end font-mono tabular-nums">{e.totalKm}</td>
                          <td className="px-4 py-3 text-end font-mono tabular-nums">{e.events}</td>
                          <td className="px-4 py-3 text-end font-mono tabular-nums font-medium">{e.eventRate ?? <span className="text-default-400">—</span>}</td>
                          <td className="px-4 py-3 text-end">
                            <button
                              onClick={() => navigate(`/drivers/${e.driverId}`)}
                              className="btn btn-icon rounded-full bg-default-100 hover:bg-primary/10 text-default-500 hover:text-primary transition-colors"
                              aria-label={`Ver detalle de ${e.name}`}>
                              <LuArrowRight className="size-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="card-footer pt-2">
                <p className="text-sm text-default-500">
                  {ranking.length} conductor{ranking.length !== 1 ? 'es' : ''} · {withBonus} con bono este período
                </p>
                <p className="text-sm text-default-400 font-mono tabular-nums">{period}</p>
              </div>
            </div>
          )}

          {rest.length === 0 && (
            <div className="card"><div className="card-footer">
              <p className="text-sm text-default-500">{ranking.length} conductor{ranking.length !== 1 ? 'es' : ''} · {withBonus} con bono este período</p>
              <p className="text-sm text-default-400 font-mono tabular-nums">{period}</p>
            </div></div>
          )}
        </>
      )}
    </div>
  );
}
