import {useEffect, useRef, useState} from 'react';
import {LuCar, LuCheck, LuChevronDown, LuClock, LuLoaderCircle, LuMinus, LuPlus, LuUser, LuX} from 'react-icons/lu';
import {createDriver, type CreatedDriver, type NewDriverInput, type ScheduleBlock, type VehicleType} from '@/api/client';
import ScheduleEditor from '@/components/ScheduleEditor';

const VEHICLE_TYPES: Array<{value: VehicleType; label: string}> = [
  {value: 'SEDAN', label: 'Sedán'},
  {value: 'SUV', label: 'SUV'},
  {value: 'VAN', label: 'Van'},
  {value: 'PICKUP', label: 'Pickup'},
  {value: 'TRUCK', label: 'Camión'},
  {value: 'BUS', label: 'Bus'},
  {value: 'MOTORCYCLE', label: 'Moto'},
];

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1990;
const MAX_YEAR = CURRENT_YEAR + 1;

/** Select custom de tipo de vehículo (patrón MonthPicker). */
function VehicleTypeSelect({value, onChange}: {value: VehicleType; onChange: (v: VehicleType) => void}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = VEHICLE_TYPES.find(t => t.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="form-input rounded flex items-center justify-between gap-2 ps-3 pe-2.5 cursor-pointer hover:border-default-300"
        aria-haspopup="listbox"
        aria-expanded={open}>
        <span className="flex items-center gap-2 text-sm text-default-800">
          <LuCar className="size-4 text-default-400" />
          {current?.label}
        </span>
        <LuChevronDown className={`size-4 text-default-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div role="listbox" className="absolute start-0 end-0 top-full mt-1.5 z-50 bg-card border border-default-200 rounded shadow-lg p-1 max-h-64 overflow-y-auto">
          {VEHICLE_TYPES.map(t => {
            const selected = t.value === value;
            return (
              <button
                key={t.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {onChange(t.value); setOpen(false);}}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded text-sm transition-colors ${
                  selected ? 'bg-primary/10 text-primary font-medium' : 'text-default-700 hover:bg-default-100'
                }`}>
                {t.label}
                {selected && <LuCheck className="size-4" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Stepper custom para el año del vehículo: [−] 2026 [+] en una sola fila. */
function YearStepper({value, onChange}: {value: number | null; onChange: (v: number | null) => void}) {
  const clamp = (n: number) => Math.max(MIN_YEAR, Math.min(MAX_YEAR, n));
  const cur = value ?? CURRENT_YEAR;
  const canDec = cur > MIN_YEAR;
  const canInc = cur < MAX_YEAR;

  return (
    <div className="form-input rounded flex items-center gap-1 p-1">
      <button
        type="button"
        onClick={() => onChange(clamp(cur - 1))}
        disabled={value !== null && !canDec}
        className="btn btn-icon size-7 rounded bg-default-100 hover:bg-default-200 text-default-600 disabled:opacity-40 shrink-0 transition-colors"
        aria-label="Año menos uno">
        <LuMinus className="size-3.5" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value === null ? '' : value}
        placeholder={String(CURRENT_YEAR)}
        onChange={e => {
          const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 4);
          onChange(raw === '' ? null : Number(raw));
        }}
        onBlur={() => {
          if (value !== null) onChange(clamp(value));
        }}
        className="min-w-0 flex-1 bg-transparent outline-none text-center text-sm text-default-800 font-mono tabular-nums placeholder:text-default-400 placeholder:font-sans"
        aria-label="Año del vehículo"
      />
      <button
        type="button"
        onClick={() => onChange(clamp(cur + 1))}
        disabled={value !== null && !canInc}
        className="btn btn-icon size-7 rounded bg-default-100 hover:bg-default-200 text-default-600 disabled:opacity-40 shrink-0 transition-colors"
        aria-label="Año más uno">
        <LuPlus className="size-3.5" />
      </button>
    </div>
  );
}

function Field({label, required, children}: {label: string; required?: boolean; children: React.ReactNode}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-default-600">
        {label}
        {required && <span className="text-danger ms-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

function SectionTitle({icon: Icon, title, hint}: {icon: typeof LuUser; title: string; hint?: string}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="size-8 rounded-md grid place-items-center bg-primary/10 text-primary shrink-0">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <h6 className="text-sm font-semibold text-default-800 leading-tight">{title}</h6>
        {hint && <p className="text-xs text-default-500 mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (driver: CreatedDriver) => void;
};

export default function DriverForm({open, onClose, onCreated}: Props) {
  // Persona
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dni, setDni] = useState('');
  const [license, setLicense] = useState('');
  // Vehículo
  const [plate, setPlate] = useState('');
  const [vType, setVType] = useState<VehicleType>('SEDAN');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState<number | null>(null);
  // Horario
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([]);
  // Estado UI
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const reset = () => {
    setName(''); setPhone(''); setDni(''); setLicense('');
    setPlate(''); setVType('SEDAN'); setBrand(''); setModel(''); setYear(null);
    setSchedule([]); setError(null); setTouched(false); setSubmitting(false);
  };

  // Cierre por tecla Escape + bloqueo de scroll del body mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) handleClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, submitting]);

  if (!open) return null;

  const nameValid = name.trim().length >= 2;

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    setTouched(true);
    if (!nameValid) {
      setError(null);
      return;
    }
    setSubmitting(true);
    setError(null);

    const input: NewDriverInput = {name: name.trim()};
    if (phone.trim()) input.phone = phone.trim();
    if (dni.trim()) input.dni = dni.trim();
    if (license.trim()) input.license = license.trim();
    if (plate.trim()) {
      input.vehicle = {plate: plate.trim().toUpperCase(), type: vType};
      if (brand.trim()) input.vehicle.brand = brand.trim();
      if (model.trim()) input.vehicle.model = model.trim();
      if (year !== null) input.vehicle.year = year;
    }
    if (schedule.length > 0) input.schedule = schedule;

    try {
      const created = await createDriver(input);
      reset();
      onCreated(created);
    } catch (err: unknown) {
      const status = (err as {response?: {status?: number}})?.response?.status;
      if (status === 409) setError('Ese código ya está en uso. Intenta de nuevo sin especificar uno.');
      else if (status === 400) setError('Revisa los datos: algún campo no es válido.');
      else setError('No se pudo crear el conductor. Verifica tu conexión e intenta otra vez.');
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 bg-default-900/50 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="driver-form-title"
      onMouseDown={e => {if (e.target === e.currentTarget) handleClose();}}>
      <div className="card w-full max-w-3xl my-auto shadow-xl">
        {/* Header */}
        <div className="card-header py-4">
          <div className="flex items-center gap-3">
            <span className="size-9 rounded-md grid place-items-center bg-primary text-white shrink-0">
              <LuPlus className="size-5" />
            </span>
            <div>
              <h5 id="driver-form-title" className="card-title">Nuevo conductor</h5>
              <p className="text-xs text-default-500 mt-0.5">El sistema generará un código de 6 caracteres para su onboarding.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="btn btn-icon bg-default-100 hover:bg-default-200 text-default-600 disabled:opacity-50 transition-colors"
            aria-label="Cerrar">
            <LuX className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="card-body !p-0 max-h-[68vh] overflow-y-auto">
          <div className="flex flex-col divide-y divide-default-200">
            {/* Persona */}
            <section className="px-6 py-6">
              <SectionTitle icon={LuUser} title="Persona" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                <div className="sm:col-span-2">
                  <Field label="Nombre completo" required>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Ej. Juan Pérez Quispe"
                      className="form-input rounded px-3 text-sm"
                      aria-invalid={touched && !nameValid}
                      autoFocus
                    />
                  </Field>
                  {touched && !nameValid && (
                    <p className="text-xs text-danger mt-1.5">Ingresa al menos 2 caracteres.</p>
                  )}
                </div>
                <Field label="Teléfono">
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="999 888 777" className="form-input rounded px-3 text-sm" />
                </Field>
                <Field label="DNI">
                  <input type="text" inputMode="numeric" value={dni} onChange={e => setDni(e.target.value.replace(/[^\d]/g, '').slice(0, 8))} placeholder="12345678" className="form-input rounded px-3 text-sm font-mono" />
                </Field>
                <Field label="Licencia">
                  <input type="text" value={license} onChange={e => setLicense(e.target.value.toUpperCase())} placeholder="Q12345678" className="form-input rounded px-3 text-sm font-mono" />
                </Field>
              </div>
            </section>

            {/* Vehículo */}
            <section className="px-6 py-6">
              <SectionTitle icon={LuCar} title="Vehículo" hint="Opcional. Si dejas la placa vacía, el conductor quedará sin vehículo asignado." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                <Field label="Placa">
                  <input type="text" value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} placeholder="ABC-123" className="form-input rounded px-3 text-sm font-mono uppercase tracking-wide" />
                </Field>
                <Field label="Tipo">
                  <VehicleTypeSelect value={vType} onChange={setVType} />
                </Field>
                <Field label="Marca">
                  <input type="text" value={brand} onChange={e => setBrand(e.target.value)} placeholder="Toyota" className="form-input rounded px-3 text-sm" />
                </Field>
                <Field label="Modelo">
                  <input type="text" value={model} onChange={e => setModel(e.target.value)} placeholder="Hilux" className="form-input rounded px-3 text-sm" />
                </Field>
                <Field label="Año">
                  <YearStepper value={year} onChange={setYear} />
                </Field>
              </div>
            </section>

            {/* Horario */}
            <section className="px-6 py-6">
              <SectionTitle icon={LuClock} title="Horario semanal" hint="Opcional. Define el turno laboral de cada día." />
              <ScheduleEditor value={schedule} onChange={setSchedule} />
            </section>

            {error && (
              <div className="px-6 py-4">
                <div className="flex items-start gap-2.5 rounded border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger" role="alert">
                  <LuX className="size-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="card-footer py-4">
          <button type="button" onClick={handleClose} disabled={submitting} className="btn bg-default-100 hover:bg-default-200 text-default-700 disabled:opacity-50 transition-colors">
            Cancelar
          </button>
          <button type="button" onClick={handleSubmit} disabled={submitting} className="btn bg-primary text-white hover:bg-primary/90 disabled:opacity-60 transition-colors">
            {submitting ? (
              <>
                <LuLoaderCircle className="size-4 animate-spin" />
                Creando…
              </>
            ) : (
              <>
                <LuCheck className="size-4" />
                Crear conductor
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
