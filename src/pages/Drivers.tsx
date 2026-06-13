import {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {LuCar, LuCheck, LuChevronRight, LuCopy, LuPlus, LuRoute, LuX} from 'react-icons/lu';
import {api, type CreatedDriver, type DriverSummary, type VehicleType} from '@/api/client';
import DriverForm from '@/components/DriverForm';

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();
}

const TONES = [
  'bg-primary/10 text-primary',
  'bg-success/15 text-success',
  'bg-amber-500/15 text-amber-600',
  'bg-violet-500/10 text-violet-600',
];

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {drivers.map((d, i) => (
            <div key={d.id} className="card">
              <div className="card-body text-center p-6">
                <div className={`size-16 mx-auto rounded-full grid place-items-center text-lg font-bold ${TONES[i % TONES.length]}`}>
                  {initials(d.name)}
                </div>
                <h6 className="mt-4 text-base font-semibold text-default-800">{d.name}</h6>
                <p className="text-sm text-default-500 mt-0.5">
                  <span className="font-mono font-semibold tracking-widest text-primary">{d.code}</span>
                </p>

                {d.vehicle && (
                  <div className="inline-flex items-center gap-1.5 text-xs text-default-600 bg-default-100 rounded-full px-3 py-1 mt-3">
                    <LuCar className="size-3.5 text-default-400" />
                    <span className="font-mono font-medium tracking-wide">{d.vehicle.plate}</span>
                    <span className="text-default-400">· {VEHICLE_LABEL[d.vehicle.type] ?? d.vehicle.type}</span>
                  </div>
                )}

                <div className="flex items-center justify-center gap-1.5 text-sm text-default-500 mt-3">
                  <LuRoute className="size-4" />
                  {d.trips} viaje{d.trips !== 1 ? 's' : ''} registrados
                </div>
                <Link
                  to={`/drivers/${d.id}`}
                  className="btn bg-primary/10 text-primary hover:bg-primary hover:text-white w-full mt-5">
                  Ver historial <LuChevronRight className="size-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <DriverForm open={formOpen} onClose={() => setFormOpen(false)} onCreated={handleCreated} />
      {created && <CreatedToast driver={created} onDismiss={() => setCreated(null)} />}
    </>
  );
}
