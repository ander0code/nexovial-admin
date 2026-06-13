import {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {LuArrowRight, LuCar, LuCheck, LuCopy, LuPlus, LuRoute, LuX} from 'react-icons/lu';
import {api, type CreatedDriver, type DriverSummary, type VehicleType} from '@/api/client';
import ScoreRing from '@/components/ui/ScoreRing';
import DriverForm from '@/components/DriverForm';

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();
}

const VEHICLE_LABEL: Record<VehicleType, string> = {
  SEDAN: 'Sedán', SUV: 'SUV', VAN: 'Van', PICKUP: 'Pickup', TRUCK: 'Camión', BUS: 'Bus', MOTORCYCLE: 'Moto',
};

/** Aviso destacado con el código del nuevo conductor, copiable. */
function CreatedToast({driver, onDismiss}: {driver: CreatedDriver; onDismiss: () => void}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(driver.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard no disponible — el código sigue visible */
    }
  };

  return (
    <div className="fixed bottom-5 end-5 z-[110] w-[min(92vw,24rem)] card shadow-xl border border-success/30" role="status">
      <div className="card-body p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="size-9 rounded-full grid place-items-center bg-success/15 text-success shrink-0">
              <LuCheck className="size-5" />
            </span>
            <div>
              <h6 className="text-sm font-semibold text-default-800">Conductor creado</h6>
              <p className="text-xs text-default-500">{driver.name}</p>
            </div>
          </div>
          <button onClick={onDismiss} className="btn btn-icon size-7 bg-default-100 hover:bg-default-200 text-default-500" aria-label="Cerrar aviso">
            <LuX className="size-4" />
          </button>
        </div>

        <div className="mt-4 rounded border border-default-200 bg-default-100/60 p-3">
          <p className="text-xs text-default-500 mb-1.5">Entrégale este código para su app:</p>
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-2xl font-bold tracking-[0.3em] text-primary">{driver.code}</span>
            <button
              onClick={copy}
              className={`btn btn-sm gap-1.5 ${copied ? 'bg-success/15 text-success' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'}`}>
              {copied ? <><LuCheck className="size-4" /> Copiado</> : <><LuCopy className="size-4" /> Copiar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Drivers() {
  const [drivers, setDrivers] = useState<DriverSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [created, setCreated] = useState<CreatedDriver | null>(null);

  const load = () => {
    setError(false);
    api.get('/api/admin/drivers')
      .then(({data}) => setDrivers(data.drivers))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreated = (driver: CreatedDriver) => {
    setFormOpen(false);
    setCreated(driver);
    load();
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <p className="text-sm text-default-500 max-w-xl">
          El código es lo único que el conductor ingresa en su app durante el onboarding.
        </p>
        <button
          onClick={() => setFormOpen(true)}
          className="btn bg-primary text-white hover:bg-primary/90 shrink-0">
          <LuPlus className="size-4" />
          Nuevo conductor
        </button>
      </div>

      {loading ? (
        <div className="card"><div className="card-body"><p className="text-default-500">Cargando…</p></div></div>
      ) : error ? (
        <div className="card">
          <div className="card-body text-center py-10">
            <p className="text-default-700 font-medium">No se pudo cargar la lista de conductores.</p>
            <button onClick={load} className="btn bg-primary/10 text-primary hover:bg-primary hover:text-white mt-4">Reintentar</button>
          </div>
        </div>
      ) : drivers.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <div className="size-12 rounded-full bg-primary/10 text-primary grid place-items-center mx-auto mb-3">
              <LuRoute className="size-6" />
            </div>
            <p className="text-default-700 font-medium">Aún no hay conductores en la flota</p>
            <p className="text-default-400 text-sm mb-4">Crea el primero para generar su código de onboarding.</p>
            <button onClick={() => setFormOpen(true)} className="btn bg-primary text-white hover:bg-primary/90">
              <LuPlus className="size-4" /> Nuevo conductor
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 items-stretch">
          {drivers.map(d => (
            <Link
              key={d.id}
              to={`/drivers/${d.id}`}
              className="group card h-auto flex flex-col p-6 transition duration-200 hover:-translate-y-1 hover:shadow-[0_12px_32px_-12px_rgb(15_23_42/0.22)] dark:hover:border-default-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
              {/* Identidad: avatar neutro + nombre + código */}
              <div className="flex items-center gap-3">
                <span className="size-11 shrink-0 rounded-2xl grid place-items-center bg-default-200 text-default-700 font-display font-bold text-sm">
                  {initials(d.name)}
                </span>
                <div className="min-w-0">
                  <h6 className="font-display font-bold text-default-800 truncate leading-tight">{d.name}</h6>
                  <p className="font-mono tabular-nums text-xs tracking-widest text-default-500 mt-0.5">{d.code}</p>
                </div>
              </div>

              {/* Score: el dato focal */}
              <div className="flex justify-center my-5">
                {d.score !== null ? (
                  <ScoreRing score={d.score} size={78} showTier />
                ) : (
                  <div className="inline-flex flex-col items-center gap-1.5">
                    <div className="size-[78px] rounded-full grid place-items-center bg-default-100 text-default-400">
                      <LuRoute className="size-7" />
                    </div>
                    <span className="label-tech text-[10px] text-default-400">Sin viajes</span>
                  </div>
                )}
              </div>

              {/* Vehículo + total de viajes */}
              <div className="space-y-2.5">
                {d.vehicle && (
                  <div className="flex items-center gap-2 text-sm text-default-600">
                    <LuCar className="size-4 shrink-0 text-default-400" />
                    <span className="font-mono tabular-nums font-medium tracking-wide text-default-700">{d.vehicle.plate}</span>
                    <span className="text-default-400">·</span>
                    <span className="text-default-500 truncate">{VEHICLE_LABEL[d.vehicle.type] ?? d.vehicle.type}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-default-600">
                  <LuRoute className="size-4 shrink-0 text-default-400" />
                  <span className="font-mono tabular-nums font-medium text-default-700">{d.trips}</span>
                  <span className="text-default-500">viaje{d.trips !== 1 ? 's' : ''} registrado{d.trips !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {/* Afordancia de navegación, anclada abajo */}
              <div className="mt-auto pt-5 flex items-center gap-1.5 text-sm font-medium text-primary">
                Ver historial
                <LuArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      )}

      <DriverForm open={formOpen} onClose={() => setFormOpen(false)} onCreated={handleCreated} />
      {created && <CreatedToast driver={created} onDismiss={() => setCreated(null)} />}
    </>
  );
}
