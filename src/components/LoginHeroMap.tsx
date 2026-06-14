import {useEffect, useRef} from 'react';

/**
 * Fondo animado del login: varias rutas GPS que se van trazando y, al completarse
 * una, arranca otra (cascada escalonada) — pinta de telemetría de flota, minimalista.
 * Decorativo (aria-hidden). UNA sola rAF maneja todas las rutas mutando el DOM directo
 * (sin re-render, sin acumular estado). Respeta prefers-reduced-motion (queda estático).
 */
const ROUTES = [
  {d: 'M40 720 C 120 600, 90 500, 200 450 S 360 360, 300 240 S 390 130, 466 72', dur: 6200, delay: 0, gap: 1400},
  {d: 'M135 748 C 195 650, 255 612, 258 505 S 205 378, 332 332 S 475 286, 488 178', dur: 7000, delay: 2300, gap: 1600},
  {d: 'M22 572 C 130 528, 172 474, 286 478 S 432 452, 482 360', dur: 5200, delay: 4300, gap: 1900},
];

export default function LoginHeroMap() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const bases = Array.from(svg.querySelectorAll<SVGPathElement>('.nv-base'));
    const trails = Array.from(svg.querySelectorAll<SVGPathElement>('.nv-trail'));
    const heads = Array.from(svg.querySelectorAll<SVGGElement>('.nv-head'));
    const totals = bases.map(p => p.getTotalLength());

    trails.forEach((tr, i) => {
      tr.style.strokeDasharray = `${totals[i]} ${totals[i]}`;
      tr.style.strokeDashoffset = String(totals[i]);
      tr.style.opacity = '0';
    });
    heads.forEach(h => (h.style.opacity = '0'));

    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      // Estático: rutas trazadas al final, sin movimiento.
      trails.forEach((tr, i) => {
        tr.style.strokeDashoffset = '0';
        tr.style.opacity = '0.85';
        const end = bases[i].getPointAtLength(totals[i]);
        heads[i].setAttribute('transform', `translate(${end.x} ${end.y})`);
        heads[i].style.opacity = '1';
      });
      return;
    }

    let raf = 0;
    let start = 0;
    const frame = (ts: number) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      for (let i = 0; i < bases.length; i++) {
        const r = ROUTES[i]!;
        const period = r.dur + r.gap;
        const e = elapsed - r.delay;
        let op: number;
        let t = 1;
        if (e >= 0) {
          const local = e % period;
          if (local < r.dur) {
            const lin = local / r.dur;
            t = ease(lin);
            op = 1;
            if (lin < 0.06) op = lin / 0.06; // fade in
            else if (lin > 0.88) op = Math.max(0, 1 - (lin - 0.88) / 0.12); // fade out al terminar
          } else {
            op = 0; // pausa entre vueltas
          }
        } else {
          op = 0; // aún no arranca (escalonado)
        }
        const total = totals[i]!;
        trails[i]!.style.strokeDashoffset = String(total * (1 - t));
        trails[i]!.style.opacity = String(op * 0.9);
        const pt = bases[i]!.getPointAtLength(t * total);
        heads[i]!.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
        heads[i]!.style.opacity = String(op);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {/* Glow + grilla de puntos (estáticos) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,112,184,0.38),_transparent_55%)]" />
      <div className="absolute -bottom-24 -left-24 size-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:26px_26px]" />

      <svg ref={svgRef} className="absolute inset-0 size-full" viewBox="0 0 500 760" fill="none" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id="nv-head-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Punto de convergencia (depósito / destino) */}
        <circle cx="466" cy="72" r="10" fill="#2570B8" opacity="0.3">
          <animate attributeName="r" values="8;16;8" dur="2.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.35;0;0.35" dur="2.6s" repeatCount="indefinite" />
        </circle>
        <circle cx="466" cy="72" r="5" fill="#2570B8" stroke="#fff" strokeWidth="1.5" />

        {/* Eventos sutiles sobre las pistas */}
        <circle cx="300" cy="240" r="4" fill="#E0922A" opacity="0.85" />
        <circle cx="258" cy="505" r="4" fill="#15A862" opacity="0.8" />

        {ROUTES.map((r, i) => (
          <g key={i}>
            {/* base punteada */}
            <path className="nv-base" d={r.d} stroke="#ffffff" strokeOpacity="0.12" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="1 12" />
            {/* trazo luminoso que se dibuja */}
            <path
              className="nv-trail"
              d={r.d}
              stroke="#3b82f6"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
              style={{filter: 'drop-shadow(0 0 5px rgba(59,130,246,0.6))', opacity: 0}}
            />
            {/* cabeza luminosa (vehículo) */}
            <g className="nv-head" filter="url(#nv-head-glow)" style={{opacity: 0}}>
              <circle r="7" fill="#3b82f6" opacity="0.35" />
              <circle r="4" fill="#ffffff" />
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
}
