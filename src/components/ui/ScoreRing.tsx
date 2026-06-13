/**
 * ScoreRing — el elemento "firma" de NexoVial (personalidad industrial/técnica).
 *
 * Dial circular tipo gauge que muestra el score del conductor. El color del arco
 * codifica el nivel (semántico — único uso de color permitido aquí). El número va
 * en Archivo pesado (num-hero) con cifras tabulares. SVG puro, sin dependencias.
 *
 * Se reutiliza en Conductores (lista), Detalle (header) y Rankings (podio) para
 * dar continuidad visual — un mismo gesto en toda la app.
 */

type Props = {
  score: number;
  /** diámetro en px (default 64) */
  size?: number;
  /** muestra el nivel debajo del número */
  showTier?: boolean;
  className?: string;
};

function tierOf(score: number): {color: string; label: string} {
  if (score >= 90) return {color: 'var(--color-success)', label: 'Excelente'};
  if (score >= 80) return {color: 'var(--color-primary)', label: 'Bueno'};
  if (score >= 70) return {color: 'var(--color-warning)', label: 'Regular'};
  return {color: 'var(--color-danger)', label: 'En riesgo'};
}

export default function ScoreRing({score, size = 64, showTier = false, className = ''}: Props) {
  const s = Math.max(0, Math.min(100, score));
  const stroke = Math.max(3, Math.round(size * 0.085));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const t = tierOf(s);

  return (
    <div className={`inline-flex flex-col items-center gap-1.5 ${className}`}>
      <div className="relative" style={{width: size, height: size}}>
        <svg width={size} height={size} className="absolute inset-0 -rotate-90 overflow-visible" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            style={{stroke: 'var(--color-default-200)'}}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            style={{
              stroke: t.color,
              strokeDasharray: c,
              strokeDashoffset: c * (1 - s / 100),
              transition: 'stroke-dashoffset .7s cubic-bezier(.22,1,.36,1)',
            }}
          />
        </svg>
        <span
          className="absolute inset-0 grid place-items-center num-hero text-default-800 leading-none"
          style={{fontSize: Math.round(size * 0.34)}}
          aria-label={`Score ${Math.round(s)}`}>
          {Math.round(s)}
        </span>
      </div>
      {showTier && (
        <span className="label-tech text-[10px]" style={{color: t.color}}>
          {t.label}
        </span>
      )}
    </div>
  );
}
