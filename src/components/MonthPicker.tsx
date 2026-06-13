import {useEffect, useRef, useState} from 'react';
import {LuCalendar, LuChevronDown, LuChevronLeft, LuChevronRight} from 'react-icons/lu';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTHS_LONG = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/**
 * Selector de período (mes/año) 100% propio — reemplaza al <input type="month">
 * nativo del navegador. value y onChange usan formato "YYYY-MM".
 */
export default function MonthPicker({value, onChange}: {value: string; onChange: (period: string) => void}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const [selYear, selMonth] = value.split('-').map(Number); // selMonth: 1-12
  const [viewYear, setViewYear] = useState(selYear);

  const now = new Date();
  const curYear = now.getUTCFullYear();
  const curMonth = now.getUTCMonth() + 1;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open) setViewYear(selYear);
  }, [open, selYear]);

  const pick = (month: number) => {
    onChange(`${viewYear}-${String(month).padStart(2, '0')}`);
    setOpen(false);
  };

  const isFuture = (year: number, month: number) => year > curYear || (year === curYear && month > curMonth);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-2 rounded-md border border-default-200 bg-card px-3.5 py-2 text-sm font-medium text-default-800 cursor-pointer transition-colors hover:border-default-300 hover:bg-default-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-haspopup="dialog"
        aria-expanded={open}>
        <LuCalendar className="size-4 text-default-400" />
        <span>{MONTHS_LONG[selMonth - 1]} {selYear}</span>
        <LuChevronDown className={`size-3.5 text-default-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-2 z-50 w-72 bg-card border border-default-200 rounded shadow-lg p-3">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setViewYear(y => y - 1)} className="btn btn-icon size-8 bg-default-100 hover:bg-default-200 text-default-600" aria-label="Año anterior">
              <LuChevronLeft className="size-4" />
            </button>
            <span className="font-semibold text-default-800 font-mono">{viewYear}</span>
            <button
              onClick={() => setViewYear(y => Math.min(curYear, y + 1))}
              disabled={viewYear >= curYear}
              className="btn btn-icon size-8 bg-default-100 hover:bg-default-200 text-default-600 disabled:opacity-40"
              aria-label="Año siguiente">
              <LuChevronRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS.map((m, i) => {
              const month = i + 1;
              const selected = viewYear === selYear && month === selMonth;
              const disabled = isFuture(viewYear, month);
              return (
                <button
                  key={m}
                  disabled={disabled}
                  onClick={() => pick(month)}
                  className={`py-2 rounded text-sm font-medium transition-colors ${
                    selected
                      ? 'bg-primary text-white'
                      : disabled
                        ? 'text-default-300 cursor-not-allowed'
                        : 'text-default-700 hover:bg-primary/10 hover:text-primary'
                  }`}>
                  {m}
                </button>
              );
            })}
          </div>

          <div className="flex justify-end mt-3 pt-3 border-t border-default-200">
            <button
              onClick={() => {onChange(`${curYear}-${String(curMonth).padStart(2, '0')}`); setOpen(false);}}
              className="text-sm font-medium text-primary hover:underline">
              Este mes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
