import {useEffect, useRef, useState} from 'react';
import {LuChevronDown, LuClock, LuCoffee, LuCopy, LuPlus, LuX} from 'react-icons/lu';
import type {ScheduleBlock} from '@/api/client';

// dayOfWeek del contrato: 0=Domingo … 6=Sábado. La UI muestra Lun→Dom.
const DAYS: Array<{dow: number; short: string; long: string}> = [
  {dow: 1, short: 'Lun', long: 'Lunes'},
  {dow: 2, short: 'Mar', long: 'Martes'},
  {dow: 3, short: 'Mié', long: 'Miércoles'},
  {dow: 4, short: 'Jue', long: 'Jueves'},
  {dow: 5, short: 'Vie', long: 'Viernes'},
  {dow: 6, short: 'Sáb', long: 'Sábado'},
  {dow: 0, short: 'Dom', long: 'Domingo'},
];

// Pasos de 30 min, 00:00–23:30
const SLOTS: number[] = Array.from({length: 48}, (_, i) => i * 30);

function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ── Estado interno del editor (más cómodo que el ScheduleBlock[] plano) ──────
type Break = {startMin: number; endMin: number};
type DayState = {works: boolean; startMin: number; endMin: number; breaks: Break[]};

const emptyDay = (): DayState => ({works: false, startMin: 480, endMin: 1080, breaks: []});

/** Selector de hora 100% propio (patrón MonthPicker): botón + panel absoluto. */
function TimePicker({value, onChange, label}: {value: number; onChange: (min: number) => void; label: string}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && listRef.current) {
      const sel = listRef.current.querySelector('[data-selected="true"]') as HTMLElement | null;
      sel?.scrollIntoView({block: 'center'});
    }
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 form-input rounded w-auto text-sm h-8 py-0 ps-2.5 pe-2 cursor-pointer hover:border-default-300 font-mono tabular-nums"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}>
        <LuClock className="size-3.5 text-default-400 shrink-0" />
        <span className="font-medium text-default-800">{fmt(value)}</span>
        <LuChevronDown className={`size-3.5 text-default-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute start-0 top-full mt-1.5 z-50 w-28 max-h-56 overflow-y-auto bg-card border border-default-200 rounded shadow-lg p-1">
          {SLOTS.map(min => {
            const selected = min === value;
            return (
              <button
                key={min}
                type="button"
                role="option"
                aria-selected={selected}
                data-selected={selected}
                onClick={() => {onChange(min); setOpen(false);}}
                className={`w-full text-start px-2.5 py-1.5 rounded text-sm font-mono tabular-nums transition-colors ${
                  selected ? 'bg-primary text-white' : 'text-default-700 hover:bg-primary/10 hover:text-primary'
                }`}>
                {fmt(min)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Switch custom accesible (form-switch del design system). */
function Switch({checked, onChange, label}: {checked: boolean; onChange: (v: boolean) => void; label: string}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
        checked ? 'bg-primary' : 'bg-default-200'
      }`}>
      <span
        className={`inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

// ── Conversión estado ↔ ScheduleBlock[] ──────────────────────────────────────
function statesToBlocks(states: Record<number, DayState>): ScheduleBlock[] {
  const blocks: ScheduleBlock[] = [];
  for (const {dow} of DAYS) {
    const d = states[dow];
    if (!d?.works) continue;
    blocks.push({dayOfWeek: dow, startMin: d.startMin, endMin: d.endMin, kind: 'WORK'});
    for (const b of d.breaks) {
      blocks.push({dayOfWeek: dow, startMin: b.startMin, endMin: b.endMin, kind: 'BREAK'});
    }
  }
  return blocks;
}

function blocksToStates(blocks: ScheduleBlock[]): Record<number, DayState> {
  const states: Record<number, DayState> = {};
  for (const {dow} of DAYS) states[dow] = emptyDay();
  for (const b of blocks) {
    const d = states[b.dayOfWeek];
    if (!d) continue;
    if (b.kind === 'WORK') {
      d.works = true;
      d.startMin = b.startMin;
      d.endMin = b.endMin;
    } else {
      d.breaks.push({startMin: b.startMin, endMin: b.endMin});
    }
  }
  return states;
}

/**
 * Editor de horario semanal. value/onChange usan ScheduleBlock[]; internamente
 * mantiene un estado por día más cómodo de manipular.
 */
export default function ScheduleEditor({value, onChange}: {value: ScheduleBlock[]; onChange: (blocks: ScheduleBlock[]) => void}) {
  const [states, setStates] = useState<Record<number, DayState>>(() => blocksToStates(value));

  // Sincroniza si el padre resetea el value (p. ej. al reabrir el modal limpio).
  useEffect(() => {
    if (value.length === 0) {
      const empty: Record<number, DayState> = {};
      for (const {dow} of DAYS) empty[dow] = emptyDay();
      setStates(empty);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (next: Record<number, DayState>) => {
    setStates(next);
    onChange(statesToBlocks(next));
  };

  const updateDay = (dow: number, patch: Partial<DayState>) => {
    commit({...states, [dow]: {...states[dow], ...patch}});
  };

  const copyMondayToAll = () => {
    const mon = states[1];
    if (!mon) return;
    const next: Record<number, DayState> = {};
    for (const {dow} of DAYS) {
      next[dow] = {
        works: mon.works,
        startMin: mon.startMin,
        endMin: mon.endMin,
        breaks: mon.breaks.map(b => ({...b})),
      };
    }
    commit(next);
  };

  const workingDays = DAYS.filter(({dow}) => states[dow]?.works).length;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3.5">
        <p className="text-xs text-default-500">
          Marca los días que trabaja y define su turno.
          <span className="text-default-400"> El descanso es opcional.</span>
        </p>
        <button
          type="button"
          onClick={copyMondayToAll}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline shrink-0">
          <LuCopy className="size-3.5" />
          Copiar lunes a la semana
        </button>
      </div>

      <div className="rounded-md border border-default-200 divide-y divide-default-200 overflow-hidden">
        {DAYS.map(({dow, short, long}) => {
          const d = states[dow];
          return (
            <div
              key={dow}
              className={`flex flex-col gap-2.5 px-4 py-3 transition-colors ${d.works ? 'bg-card' : 'bg-default-100/50'}`}>
              <div className="flex items-center gap-3.5">
                <Switch checked={d.works} onChange={v => updateDay(dow, {works: v})} label={`Trabaja el ${long}`} />
                <span className={`w-9 text-sm font-semibold shrink-0 ${d.works ? 'text-default-800' : 'text-default-400'}`}>{short}</span>

                {d.works ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <TimePicker value={d.startMin} onChange={v => updateDay(dow, {startMin: v})} label={`Inicio ${long}`} />
                    <span className="text-default-400 text-xs">a</span>
                    <TimePicker value={d.endMin} onChange={v => updateDay(dow, {endMin: v})} label={`Fin ${long}`} />
                  </div>
                ) : (
                  <span className="text-sm text-default-400 italic">Libre</span>
                )}
              </div>

              {d.works && (
                <div className="ps-[3.25rem] flex flex-col gap-2">
                  {d.breaks.map((b, i) => (
                    <div key={i} className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-default-500 w-20 shrink-0">
                        <LuCoffee className="size-3.5 text-default-400" />
                        Descanso
                      </span>
                      <TimePicker
                        value={b.startMin}
                        onChange={v => {
                          const breaks = d.breaks.map((x, j) => (j === i ? {...x, startMin: v} : x));
                          updateDay(dow, {breaks});
                        }}
                        label={`Inicio descanso ${long}`}
                      />
                      <span className="text-default-400 text-xs">a</span>
                      <TimePicker
                        value={b.endMin}
                        onChange={v => {
                          const breaks = d.breaks.map((x, j) => (j === i ? {...x, endMin: v} : x));
                          updateDay(dow, {breaks});
                        }}
                        label={`Fin descanso ${long}`}
                      />
                      <button
                        type="button"
                        onClick={() => updateDay(dow, {breaks: d.breaks.filter((_, j) => j !== i)})}
                        className="btn btn-icon size-7 bg-default-100 hover:bg-danger/10 text-default-500 hover:text-danger transition-colors"
                        aria-label="Quitar descanso">
                        <LuX className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => updateDay(dow, {breaks: [...d.breaks, {startMin: 780, endMin: 840}]})}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline w-fit">
                    <LuPlus className="size-3.5" />
                    descanso
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-2.5 text-xs text-default-400">
        {workingDays === 0
          ? 'Aún no hay días de trabajo definidos. El horario es opcional.'
          : `${workingDays} ${workingDays === 1 ? 'día de trabajo' : 'días de trabajo'} a la semana.`}
      </p>
    </div>
  );
}
