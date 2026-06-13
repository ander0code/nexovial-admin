import {useCallback, useEffect, useMemo, useState} from 'react';
import {LuRoute, LuCircleDot, LuMapPinOff, LuClock, LuCar} from 'react-icons/lu';
import {api, type FleetDriver, type FleetMapResponse} from '@/api/client';
import {getAdmin} from '@/auth';
import {getSocket} from '@/api/socket';
import FleetMapCanvas from '@/components/FleetMapCanvas';

const RANGES = [
  {key: '1', label: '24 h', days: 1},
  {key: '7', label: '7 días', days: 7},
  {key: '30', label: '30 días', days: 30},
  {key: '90', label: '90 días', days: 90},
] as const;

function tierColor(score: number | null): string {
  if (score === null) return '#64748B';
  if (score >= 90) return '#15A862';
  if (score >= 80) return '#2570B8';
  if (score >= 70) return '#E0922A';
  return '#D8453C';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·';
}

/** "hace 2 h" / "hace 3 d" / "ayer" — relativo y en español, sin librerías. */
function timeAgo(iso: string | null): string {
  if (!iso) return 'sin viajes';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return 'ayer';
  return `hace ${d} d`;
}

function hasPosition(d: FleetDriver): boolean {
  return d.trips.some(t => t.route !== null && t.route.length > 0);
}

export default function FleetMap() {
  const [rangeKey, setRangeKey] = useState<(typeof RANGES)[number]['key']>('7');
  const [data, setData] = useState<FleetMapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAllRoutes, setShowAllRoutes] = useState(false);

  const fetchData = useCallback(async () => {
    const range = RANGES.find(r => r.key === rangeKey)!;
    const to = new Date();
    const from = new Date(to.getTime() - range.days * 24 * 60 * 60 * 1000);
    try {
      setError(false);
      const {data} = await api.get<FleetMapResponse>('/api/admin/fleet/map', {
        params: {from: from.toISOString(), to: to.toISOString()},
      });
      setData(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [rangeKey]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Vivo-al-terminar: cuando un conductor cierra un viaje, refrescamos el mapa.
  useEffect(() => {
    const admin = getAdmin();
    if (!admin) return;
    const socket = getSocket(admin.companyId);
    const onSync = () => fetchData();
    socket.on('trip_synced', onSync);
    return () => {
      socket.off('trip_synced', onSync);
    };
  }, [fetchData]);

  const drivers = useMemo(() => data?.drivers ?? [], [data]);
  const onShiftCount = drivers.filter(d => d.onShiftNow).length;
  const withActivity = drivers.filter(hasPosition).length;
  const anyPosition = withActivity > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de control */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-default-500">Rango</span>
          <div className="inline-flex rounded-full bg-card p-1 shadow-[0_2px_12px_-8px_rgb(15_23_42/0.25)]">
            {RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => setRangeKey(r.key)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  rangeKey === r.key ? 'bg-primary text-white' : 'text-default-500 hover:text-default-800'
                }`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm text-default-600">
            <span className="size-2 rounded-full bg-success" />
            {onShiftCount} en turno
          </span>
          <button
            onClick={() => setShowAllRoutes(v => !v)}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              showAllRoutes
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-default-200 bg-card text-default-600 hover:text-default-900'
            }`}>
            <LuRoute className="size-4" />
            Ver todos los recorridos
          </button>
        </div>
      </div>

      {/* Panel + mapa */}
      <div className="flex flex-col gap-4 lg:h-[calc(100dvh-15rem)] lg:min-h-[480px] lg:flex-row">
        {/* Panel de conductores */}
        <aside className="card flex flex-col lg:w-80 lg:shrink-0 lg:overflow-hidden">
          <div className="border-b border-default-200/70 px-4 py-3">
            <h3 className="font-bold text-default-900">Conductores</h3>
            <p className="text-xs text-default-500">
              {withActivity} con actividad · {drivers.length} en la flota
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loading ? (
              <ul className="space-y-2 p-1">
                {[0, 1, 2, 3].map(i => (
                  <li key={i} className="h-16 animate-pulse rounded-xl bg-default-100" />
                ))}
              </ul>
            ) : drivers.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-default-500">Sin conductores en la flota.</p>
            ) : (
              <ul className="space-y-1">
                {drivers.map(d => {
                  const selected = d.id === selectedId;
                  const positioned = hasPosition(d);
                  const color = tierColor(d.score);
                  return (
                    <li key={d.id}>
                      <button
                        onClick={() => setSelectedId(selected ? null : d.id)}
                        disabled={!positioned}
                        className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-start transition-colors ${
                          selected
                            ? 'bg-default-100 shadow-[inset_0_0_0_1.5px] shadow-primary/40'
                            : positioned
                              ? 'hover:bg-default-100'
                              : 'cursor-not-allowed opacity-55'
                        }`}>
                        <span
                          className="grid size-10 shrink-0 place-items-center rounded-full text-xs font-bold"
                          style={{background: `${color}1A`, color, border: `1.5px solid ${color}55`}}>
                          {initials(d.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate font-semibold text-default-900">{d.name}</span>
                            {d.onShiftNow && (
                              <LuCircleDot className="size-3.5 shrink-0 text-success" title="En turno ahora" />
                            )}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-default-500">
                            <LuClock className="size-3" />
                            {timeAgo(d.lastTripEndTime)}
                            {d.vehicle && (
                              <>
                                <span className="text-default-300">·</span>
                                <LuCar className="size-3" />
                                <span className="font-mono">{d.vehicle.plate}</span>
                              </>
                            )}
                          </span>
                        </span>
                        <span className="shrink-0 text-end">
                          <span className="font-mono text-lg font-bold tabular-nums" style={{color}}>
                            {d.score ?? '—'}
                          </span>
                          <span className="block text-[10px] uppercase tracking-wide text-default-400">score</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Mapa */}
        <div className="relative min-h-[420px] flex-1 lg:h-full">
          {error ? (
            <div className="grid size-full place-items-center rounded-2xl bg-default-100 text-center">
              <div>
                <p className="text-default-700">No se pudo cargar el mapa.</p>
                <button onClick={() => fetchData()} className="mt-2 text-sm font-semibold text-primary">
                  Reintentar
                </button>
              </div>
            </div>
          ) : (
            <>
              <FleetMapCanvas
                drivers={drivers}
                selectedId={selectedId}
                showAllRoutes={showAllRoutes}
                onSelect={setSelectedId}
              />
              {!loading && !anyPosition && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div className="pointer-events-auto rounded-2xl border border-default-200 bg-card/95 px-5 py-4 text-center shadow-lg backdrop-blur">
                    <div className="mx-auto mb-2 grid size-11 place-items-center rounded-full bg-default-100 text-default-400">
                      <LuMapPinOff className="size-5" />
                    </div>
                    <p className="text-sm text-default-600">Sin recorridos en este rango.</p>
                    <p className="text-xs text-default-400">Prueba un rango más amplio.</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
