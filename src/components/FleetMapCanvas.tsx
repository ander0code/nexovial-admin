import {useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {LuTriangleAlert, LuX, LuArrowRight} from 'react-icons/lu';
import type {FleetDriver} from '@/api/client';

// Voyager (no Positron) en claro: tiene tinte sutil en calles/agua/parques, así el
// mapa no se "pierde" sobre el lienzo blanco. Dark-matter en oscuro. (Para volver al
// minimalismo de Positron: cambiar voyager → positron en esta línea.)
const MAP_STYLE_LIGHT = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const MAP_STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const LIMA: [number, number] = [-77.03, -12.06];

const EVENT_COLOR: Record<string, string> = {
  HARD_BRAKE: '#D8453C',
  HARSH_ACCEL: '#E0922A',
  SHARP_TURN: '#7C5CFC',
  SPEEDING: '#2570B8',
};

const EVENT_LABEL: Record<string, string> = {
  HARD_BRAKE: 'Frenada brusca',
  HARSH_ACCEL: 'Aceleración brusca',
  SHARP_TURN: 'Giro cerrado',
  SPEEDING: 'Exceso de velocidad',
};

const EVENT_BLURB: Record<string, string> = {
  HARD_BRAKE: 'Frenada brusca detectada — penalizó el score del viaje.',
  HARSH_ACCEL: 'Aceleración brusca detectada — penalizó el score del viaje.',
  SHARP_TURN: 'Giro cerrado a alta velocidad — penalizó el score del viaje.',
  SPEEDING: 'Exceso de velocidad detectado — penalizó el score del viaje.',
};

type GeoEvent = {type: string; severity: number; lat: number; lng: number; timestamp: string};
type SelectedEvent = {ev: GeoEvent; key: string; driverName: string; driverId: string; tripId: string};

/** Nivel de severidad para mostrar (cortes de magnitud; NO afecta el score). */
function severityLevel(type: string, severity: number): {label: string; color: string} {
  if (type === 'SPEEDING') {
    if (severity >= 20) return {label: 'Crítico', color: '#D8453C'};
    if (severity >= 10) return {label: 'Alto', color: '#E0922A'};
    return {label: 'Moderado', color: '#64748B'};
  }
  if (severity >= 0.6) return {label: 'Crítico', color: '#D8453C'};
  if (severity >= 0.45) return {label: 'Alto', color: '#E0922A'};
  return {label: 'Moderado', color: '#64748B'};
}

function severityText(type: string, severity: number): string {
  return type === 'SPEEDING' ? `+${severity} km/h` : `${severity.toFixed(2)}g`;
}

/** Color por tramo de score — mismo criterio que el ScoreRing (riesgo a la vista). */
function tierColor(score: number | null): string {
  if (score === null) return '#64748B'; // sin datos → gris
  if (score >= 90) return '#15A862'; // success
  if (score >= 80) return '#2570B8'; // primary
  if (score >= 70) return '#E0922A'; // warning
  return '#D8453C'; // danger
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·';
}

/** Último punto del viaje más reciente CON ruta → "posición conocida" del conductor. */
function driverPosition(d: FleetDriver): [number, number] | null {
  for (const t of d.trips) {
    if (t.route && t.route.length > 0) {
      const last = t.route[t.route.length - 1]!;
      return [last.lng, last.lat];
    }
  }
  return null;
}

// Tipos GeoJSON mínimos locales (@types/geojson no está instalado en el proyecto).
type RouteLine = {
  type: 'Feature';
  properties: {color: string; width: number; opacity: number};
  geometry: {type: 'LineString'; coordinates: [number, number][]};
};
type RouteCollection = {type: 'FeatureCollection'; features: RouteLine[]};

/** Construye las líneas de ruta según la selección/visibilidad actual. */
function buildRoutes(drivers: FleetDriver[], selectedId: string | null, showAll: boolean): RouteCollection {
  const features: RouteLine[] = [];
  for (const d of drivers) {
    const isSel = d.id === selectedId;
    let width: number;
    let opacity: number;
    if (selectedId) {
      if (isSel) {
        width = 5;
        opacity = 1;
      } else if (showAll) {
        width = 2;
        opacity = 0.2;
      } else {
        continue; // hay selección y este no es: ocultar
      }
    } else if (showAll) {
      width = 2.5;
      opacity = 0.55;
    } else {
      continue; // sin selección y sin "ver todos": mapa limpio (solo marcadores)
    }
    const color = tierColor(d.score);
    for (const t of d.trips) {
      if (!t.route || t.route.length < 2) continue;
      features.push({
        type: 'Feature',
        properties: {color, width, opacity},
        geometry: {type: 'LineString', coordinates: t.route.map(p => [p.lng, p.lat])},
      });
    }
  }
  return {type: 'FeatureCollection', features};
}

export default function FleetMapCanvas({
  drivers,
  selectedId,
  showAllRoutes,
  onSelect,
}: {
  drivers: FleetDriver[];
  selectedId: string | null;
  showAllRoutes: boolean;
  onSelect: (id: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const driverMarkersRef = useRef<maplibregl.Marker[]>([]);
  const eventMarkersRef = useRef<maplibregl.Marker[]>([]);
  // Elementos DOM (el dot interno) de cada marcador de evento, por clave → para resaltar.
  const eventElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const firstFitRef = useRef(true);
  // Ref para que el handler de clic del marcador no quede con un onSelect viejo.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const [ready, setReady] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.dataset.theme === 'dark');
  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent | null>(null);
  // Ref espejo para leer el evento seleccionado dentro de handlers del mapa.
  const selectedEventRef = useRef<SelectedEvent | null>(selectedEvent);
  selectedEventRef.current = selectedEvent;

  // Reacciona al toggle de tema en vivo (igual que TripMap).
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.dataset.theme === 'dark'));
    obs.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
    return () => obs.disconnect();
  }, []);

  // ── Crear el mapa (una vez por tema) ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setReady(false);
    firstFitRef.current = true;

    const map = new maplibregl.Map({
      container,
      style: isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT,
      attributionControl: false,
      center: LIMA,
      zoom: 11,
      // Mapa de flota = norte fijo, 2D (como Samsara/Geotab). Sin giro ni inclinación:
      // si el mapa rota, los marcadores (que se mantienen de pie) se desplazan en arco
      // y parece que "se mueven solos". Bloquearlo deja todo estable en pan/zoom.
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({showCompass: false}), 'top-right');
    map.touchZoomRotate.disableRotation(); // trackpad: zoom sí, rotación no
    map.on('error', e => {
      const msg = (e as {error?: Error}).error?.message;
      if (msg) console.warn('[FleetMap]', msg);
    });
    requestAnimationFrame(() => map.resize());

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container);

    map.on('load', () => {
      map.resize();
      map.addSource('fleet-routes', {type: 'geojson', data: {type: 'FeatureCollection', features: []}});
      map.addLayer({
        id: 'fleet-routes-line',
        type: 'line',
        source: 'fleet-routes',
        layout: {'line-cap': 'round', 'line-join': 'round'},
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['get', 'width'],
          'line-opacity': ['get', 'opacity'],
        },
      });
      // Clic en el lienzo: cierra el detalle del evento si hay uno; si no, deselecciona.
      map.on('click', () => {
        if (selectedEventRef.current) setSelectedEvent(null);
        else onSelectRef.current(null);
      });
      setReady(true);
    });

    return () => {
      ro.disconnect();
      for (const m of driverMarkersRef.current) m.remove();
      for (const m of eventMarkersRef.current) m.remove();
      driverMarkersRef.current = [];
      eventMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [isDark]);

  // ── Pintar marcadores + rutas + encuadre según datos/selección ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    // Rutas
    const src = map.getSource('fleet-routes') as maplibregl.GeoJSONSource | undefined;
    src?.setData(buildRoutes(drivers, selectedId, showAllRoutes));

    // Marcadores de posición (rehacerlos es barato: son pocos)
    for (const m of driverMarkersRef.current) m.remove();
    driverMarkersRef.current = [];

    for (const d of drivers) {
      const pos = driverPosition(d);
      if (!pos) continue;
      const selected = d.id === selectedId;
      const dimmed = selectedId !== null && !selected;
      const color = tierColor(d.score);
      const el = buildMarkerEl({
        label: initials(d.name),
        name: d.name,
        scoreText: d.score == null ? '—' : String(d.score),
        plate: d.vehicle?.plate ?? null,
        color,
        onShift: d.onShiftNow,
        selected,
        dimmed,
        dark: isDark,
      });
      el.addEventListener('click', e => {
        e.stopPropagation();
        onSelectRef.current(selected ? null : d.id);
      });
      const marker = new maplibregl.Marker({element: el}).setLngLat(pos).addTo(map);
      driverMarkersRef.current.push(marker);
    }

    // Marcadores de evento (solo del conductor seleccionado) — clic = tarjeta de detalle
    for (const m of eventMarkersRef.current) m.remove();
    eventMarkersRef.current = [];
    eventElsRef.current = new Map();
    if (selectedId) {
      const sel = drivers.find(d => d.id === selectedId);
      sel?.trips.forEach((t, ti) => {
        t.events.forEach((ev, ei) => {
          if (typeof ev.lat !== 'number' || typeof ev.lng !== 'number') return;
          const geo: GeoEvent = {type: ev.type, severity: ev.severity, lat: ev.lat, lng: ev.lng, timestamp: ev.timestamp};
          const key = `${sel.id}:${ti}:${ei}`;
          // Wrapper (lo posiciona MapLibre) + dot interno (lo escalamos al resaltar).
          const wrap = document.createElement('div');
          wrap.style.cssText = 'width:15px;height:15px;cursor:pointer;';
          const dot = document.createElement('div');
          dot.style.cssText =
            'width:100%;height:100%;border-radius:9999px;border:2px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,.4);transition:transform .12s ease, box-shadow .12s ease;';
          dot.style.background = EVENT_COLOR[ev.type] ?? '#64748B';
          wrap.appendChild(dot);
          wrap.addEventListener('click', e => {
            e.stopPropagation();
            setSelectedEvent({ev: geo, key, driverName: sel.name, driverId: sel.id, tripId: t.id});
          });
          eventElsRef.current.set(key, dot);
          const m = new maplibregl.Marker({element: wrap}).setLngLat([ev.lng, ev.lat]).addTo(map);
          eventMarkersRef.current.push(m);
        });
      });
    }

    // Encuadre
    const bounds = new maplibregl.LngLatBounds();
    if (selectedId) {
      const sel = drivers.find(d => d.id === selectedId);
      for (const t of sel?.trips ?? []) {
        for (const p of t.route ?? []) bounds.extend([p.lng, p.lat]);
      }
      const pos = sel ? driverPosition(sel) : null;
      if (pos) bounds.extend(pos);
    } else {
      for (const d of drivers) {
        const pos = driverPosition(d);
        if (pos) bounds.extend(pos);
        if (showAllRoutes) {
          for (const t of d.trips) for (const p of t.route ?? []) bounds.extend([p.lng, p.lat]);
        }
      }
    }
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding: 64,
        maxZoom: selectedId ? 15 : 13,
        duration: firstFitRef.current ? 0 : 700,
      });
      firstFitRef.current = false;
    }
  }, [drivers, selectedId, showAllRoutes, ready, isDark]);

  // Cierra el detalle si cambia el conductor, los datos o el tema (los eventos cambian).
  useEffect(() => {
    setSelectedEvent(null);
  }, [selectedId, drivers, isDark]);

  // Resalta el marcador del evento seleccionado (escala el dot interno, sin mover).
  useEffect(() => {
    eventElsRef.current.forEach((el, key) => {
      const sel = selectedEvent?.key === key;
      el.style.transform = sel ? 'scale(1.7)' : 'scale(1)';
      el.style.boxShadow = sel
        ? '0 0 0 4px rgba(37,112,184,0.35), 0 2px 6px rgba(15,23,42,.45)'
        : '0 1px 4px rgba(15,23,42,.4)';
      el.style.zIndex = sel ? '5' : '1';
    });
  }, [selectedEvent]);

  const detail = selectedEvent
    ? (() => {
        const {ev, driverName, driverId, tripId} = selectedEvent;
        const lvl = severityLevel(ev.type, ev.severity);
        return {
          driverName,
          driverId,
          tripId,
          label: EVENT_LABEL[ev.type] ?? ev.type,
          color: EVENT_COLOR[ev.type] ?? '#64748B',
          sev: severityText(ev.type, ev.severity),
          lvl,
          when: new Date(ev.timestamp).toLocaleString('es-PE', {day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'}),
          blurb: EVENT_BLURB[ev.type] ?? 'Evento de riesgo detectado.',
        };
      })()
    : null;

  return (
    <div className="relative size-full">
      <div
        ref={containerRef}
        className="size-full overflow-hidden rounded-2xl border border-default-200 bg-default-100 shadow-[0_6px_28px_-14px_rgb(15_23_42/0.22)] dark:shadow-none"
      />

      {/* Leyenda: el color = nivel de score (estado), no identidad. La identidad va en
          las iniciales + el tooltip al hover → así diferencias 30 choferes sin 30 colores. */}
      <div className="absolute bottom-3 right-3 z-[5] rounded-xl border border-default-200 bg-card/90 px-3 py-2.5 shadow-lg backdrop-blur">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-default-400">Score del conductor</p>
        <ul className="space-y-1">
          {[
            {c: '#15A862', l: 'Excelente', r: '90–100'},
            {c: '#2570B8', l: 'Bueno', r: '80–89'},
            {c: '#E0922A', l: 'Regular', r: '70–79'},
            {c: '#D8453C', l: 'En riesgo', r: '<70'},
          ].map(t => (
            <li key={t.l} className="flex items-center gap-2 text-xs">
              <span className="size-2.5 rounded-full" style={{background: t.c}} />
              <span className="font-medium text-default-700">{t.l}</span>
              <span className="ms-auto ps-3 font-mono text-[11px] text-default-400">{t.r}</span>
            </li>
          ))}
        </ul>
      </div>

      {detail && (
        <div className="card absolute bottom-3 left-3 right-3 z-10 border border-default-200 shadow-lg sm:right-auto sm:w-80">
          <div className="card-body p-4">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded" style={{background: `${detail.color}1A`, color: detail.color}}>
                <LuTriangleAlert className="size-4.5" />
              </span>
              <div className="min-w-0 flex-grow">
                <h6 className="font-semibold leading-tight text-default-800">{detail.label}</h6>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-default-800">{detail.sev}</span>
                  <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold" style={{background: `${detail.lvl.color}1A`, color: detail.lvl.color}}>
                    {detail.lvl.label}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                aria-label="Cerrar detalle"
                className="btn btn-icon -me-1 -mt-1 size-7 shrink-0 text-default-400 hover:text-default-700">
                <LuX className="size-4" />
              </button>
            </div>
            <p className="mt-2.5 border-t border-default-200 pt-2.5 text-xs text-default-500">{detail.blurb}</p>
            <p className="mt-1.5 font-mono text-xs text-default-400">
              {detail.driverName} · {detail.when}
            </p>
            <Link
              to={`/drivers/${detail.driverId}?trip=${detail.tripId}`}
              className="group mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15">
              Ver viaje completo
              <LuArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/** Marcador de conductor: círculo con iniciales (identidad), color por score (estado),
 *  anillo si está en turno, y tooltip al hover con nombre/score/placa (identificar sin clic). */
function buildMarkerEl({
  label,
  name,
  scoreText,
  plate,
  color,
  onShift,
  selected,
  dimmed,
  dark,
}: {
  label: string;
  name: string;
  scoreText: string;
  plate: string | null;
  color: string;
  onShift: boolean;
  selected: boolean;
  dimmed: boolean;
  dark: boolean;
}): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;display:grid;place-items:center;width:42px;height:42px;cursor:pointer;';
  wrap.style.opacity = dimmed ? '0.5' : '1';
  wrap.style.transition = 'opacity .15s ease';

  if (onShift) {
    const ring = document.createElement('span');
    ring.className = 'animate-ping';
    ring.style.cssText =
      'position:absolute;width:30px;height:30px;border-radius:9999px;opacity:.55;';
    ring.style.background = color;
    wrap.appendChild(ring);
  }

  const circle = document.createElement('div');
  const size = selected ? 36 : 30;
  circle.style.cssText = `position:relative;display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:9999px;font-size:12px;font-weight:700;letter-spacing:.02em;transition:all .15s ease;`;
  circle.style.border = `2px solid ${color}`;
  if (selected) {
    circle.style.background = color;
    circle.style.color = '#fff';
    circle.style.boxShadow = `0 0 0 4px ${color}33, 0 4px 12px rgba(15,23,42,.4)`;
  } else {
    circle.style.background = dark ? '#18181b' : '#ffffff';
    circle.style.color = color;
    circle.style.boxShadow = '0 2px 6px rgba(15,23,42,.28)';
  }
  circle.textContent = label;
  wrap.appendChild(circle);

  // Tooltip de identidad (nombre · score · placa) — aparece al pasar el mouse.
  const tip = document.createElement('div');
  tip.style.cssText =
    'position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);white-space:nowrap;background:#18181b;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:5px 9px;box-shadow:0 8px 22px -8px rgba(0,0,0,.6);opacity:0;transition:opacity .12s ease;pointer-events:none;z-index:30;';
  const tName = document.createElement('div');
  tName.style.cssText = 'font-weight:700;font-size:12px;line-height:1.2;';
  tName.textContent = name;
  const tSub = document.createElement('div');
  tSub.style.cssText = 'font-size:10px;opacity:.65;font-family:ui-monospace,monospace;margin-top:1px;';
  tSub.textContent = `Score ${scoreText}${plate ? ' · ' + plate : ''}${onShift ? ' · en turno' : ''}`;
  tip.appendChild(tName);
  tip.appendChild(tSub);
  wrap.appendChild(tip);

  wrap.addEventListener('mouseenter', () => {
    tip.style.opacity = '1';
    wrap.style.opacity = '1'; // resalta al pasar el mouse (incluso si estaba atenuado)
    wrap.style.zIndex = '10';
  });
  wrap.addEventListener('mouseleave', () => {
    tip.style.opacity = '0';
    wrap.style.opacity = dimmed ? '0.5' : '1';
    wrap.style.zIndex = '';
  });

  return wrap;
}
