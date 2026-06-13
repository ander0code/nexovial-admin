import {useCallback, useEffect, useRef, useState} from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {LuMapPinOff, LuMaximize, LuMinimize, LuX, LuTriangleAlert} from 'react-icons/lu';
import type {RoutePoint, TripDetail} from '@/api/client';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const ROUTE_COLOR = '#2570B8';
const START_COLOR = '#1F8A5F';
const END_COLOR = '#64748B';

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

// Frase explicativa por tipo de evento para la tarjeta de detalle.
const EVENT_BLURB: Record<string, string> = {
  HARD_BRAKE: 'Frenada brusca detectada — penalizó el score del viaje.',
  HARSH_ACCEL: 'Aceleración brusca detectada — penalizó el score del viaje.',
  SHARP_TURN: 'Giro cerrado a alta velocidad — penalizó el score del viaje.',
  SPEEDING: 'Exceso de velocidad detectado — penalizó el score del viaje.',
};

// Leyenda — solo eventos de Fase 1 (SPEEDING es Fase 2).
const LEGEND: Array<{type: string; label: string}> = [
  {type: 'HARD_BRAKE', label: 'Frenada'},
  {type: 'HARSH_ACCEL', label: 'Aceleración'},
  {type: 'SHARP_TURN', label: 'Giro'},
];

type EventPoint = TripDetail['events'][number];
type GeoEvent = EventPoint & {lat: number; lng: number};

function hasCoords(e: EventPoint): e is GeoEvent {
  return typeof e.lat === 'number' && typeof e.lng === 'number';
}

/** Nivel de severidad para alertas en tiempo real (NO afecta el score). */
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

/**
 * Marcador HTML: un WRAPPER (que MapLibre posiciona con `transform: translate`) y
 * un DOT interno (que escalamos en el resaltado). Separarlos evita el bug donde
 * `transform: scale` pisaba el translate y mandaba el marcador a la esquina 0,0.
 */
function dotEl(color: string, size: number, ring = true): {wrap: HTMLDivElement; dot: HTMLDivElement} {
  const wrap = document.createElement('div');
  wrap.style.width = `${size}px`;
  wrap.style.height = `${size}px`;
  const dot = document.createElement('div');
  dot.style.width = '100%';
  dot.style.height = '100%';
  dot.style.background = color;
  dot.style.borderRadius = '9999px';
  dot.style.cursor = 'pointer';
  dot.style.transition = 'transform .12s ease, box-shadow .12s ease';
  if (ring) {
    dot.style.border = '2px solid #fff';
    dot.style.boxShadow = '0 1px 4px rgba(15,23,42,0.35)';
  }
  wrap.appendChild(dot);
  return {wrap, dot};
}

export default function TripMap({
  route,
  events,
  height = 380,
}: {
  route: RoutePoint[] | null;
  events: TripDetail['events'];
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // Guarda los elementos DOM de los marcadores de evento por índice, para
  // poder resaltar el seleccionado sin recrear el mapa.
  const markerEls = useRef<Map<number, HTMLDivElement>>(new Map());

  const [fullscreen, setFullscreen] = useState(false);
  const [selected, setSelected] = useState<{ev: GeoEvent; idx: number} | null>(null);

  const coords = route ?? [];
  const eventCoords = events.filter(hasCoords);
  const hasGeo = coords.length > 0 || eventCoords.length > 0;

  // Cierra cualquier selección/fullscreen al cambiar de viaje.
  useEffect(() => {
    setSelected(null);
    setFullscreen(false);
  }, [route, events]);

  // Resalta el marcador seleccionado (anillo + tamaño).
  useEffect(() => {
    markerEls.current.forEach((el, idx) => {
      const isSel = selected?.idx === idx;
      el.style.transform = isSel ? 'scale(1.55)' : 'scale(1)';
      el.style.boxShadow = isSel
        ? '0 0 0 4px rgba(37,112,184,0.35), 0 2px 6px rgba(15,23,42,0.4)'
        : '0 1px 4px rgba(15,23,42,0.35)';
      el.style.zIndex = isSel ? '5' : '1';
    });
  }, [selected]);

  // ESC cierra fullscreen y/o la tarjeta de detalle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (selected) setSelected(null);
      else if (fullscreen) setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen, selected]);

  useEffect(() => {
    const container = containerRef.current;
    // Recalculamos DENTRO del effect: si dependiéramos de `coords`/`eventCoords`
    // (arrays nuevos en cada render) el mapa se recrearía en bucle y saldría en blanco.
    const coords = route ?? [];
    const eventCoords = events.filter(hasCoords);
    if (!container || (coords.length === 0 && eventCoords.length === 0)) return;

    // Centro inicial: primer punto de la ruta (o evento, o Lima) — así el basemap
    // se dibuja de inmediato aunque el fitBounds llegue después en 'load'.
    const firstPoint = coords[0] ?? eventCoords[0] ?? null;
    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      attributionControl: false,
      center: firstPoint ? [firstPoint.lng, firstPoint.lat] : [-77.03, -12.06],
      zoom: 12,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({showCompass: false}), 'top-right');
    map.scrollZoom.disable(); // evita zoom accidental al hacer scroll en la página
    map.on('error', e => {
      const msg = (e as {error?: Error}).error?.message;
      if (msg) console.warn('[TripMap]', msg);
    });
    // Fuerza un remeasure tras el primer paint (contenedor en grid/tab/flex)
    requestAnimationFrame(() => map.resize());

    const markers: maplibregl.Marker[] = [];
    markerEls.current = new Map();

    // Reajusta el tamaño cuando el contenedor cambia (clave en layouts flex/grid/tab)
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container);

    map.on('load', () => {
      map.resize(); // asegura el tamaño correcto una vez montado el layout
      // ── Ruta como LineString ──
      if (coords.length >= 2) {
        const line: [number, number][] = coords.map(p => [p.lng, p.lat]);
        map.addSource('route', {
          type: 'geojson',
          data: {type: 'Feature', geometry: {type: 'LineString', coordinates: line}, properties: {}},
        });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: {'line-cap': 'round', 'line-join': 'round'},
          paint: {'line-color': ROUTE_COLOR, 'line-width': 4},
        });

        // Inicio y fin de la ruta
        const start = coords[0];
        const end = coords[coords.length - 1];
        markers.push(
          new maplibregl.Marker({element: dotEl(START_COLOR, 16).wrap})
            .setLngLat([start.lng, start.lat])
            .setPopup(new maplibregl.Popup({offset: 14, closeButton: false}).setText('Inicio'))
            .addTo(map),
        );
        markers.push(
          new maplibregl.Marker({element: dotEl(END_COLOR, 16).wrap})
            .setLngLat([end.lng, end.lat])
            .setPopup(new maplibregl.Popup({offset: 14, closeButton: false}).setText('Fin'))
            .addTo(map),
        );
      }

      // ── Marcadores de evento (clic → tarjeta de detalle) ──
      eventCoords.forEach((ev, idx) => {
        const color = EVENT_COLOR[ev.type] ?? '#64748B';
        const {wrap, dot} = dotEl(color, 15);
        dot.addEventListener('click', e => {
          e.stopPropagation();
          setSelected({ev, idx});
        });
        // guardamos el DOT (no el wrapper) para escalarlo sin tocar la posición
        markerEls.current.set(idx, dot);
        markers.push(new maplibregl.Marker({element: wrap}).setLngLat([ev.lng, ev.lat]).addTo(map));
      });

      // Clic en el lienzo cierra la tarjeta de detalle.
      map.on('click', () => setSelected(null));

      // ── Encuadre ──
      const bounds = new maplibregl.LngLatBounds();
      const fitPoints = coords.length > 0 ? coords.map(p => [p.lng, p.lat] as [number, number]) : eventCoords.map(e => [e.lng, e.lat] as [number, number]);
      for (const p of fitPoints) bounds.extend(p);
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {padding: 48, maxZoom: 16, duration: 0});
      }
    });

    return () => {
      ro.disconnect();
      for (const m of markers) m.remove();
      markerEls.current = new Map();
      map.remove();
      mapRef.current = null;
    };
  }, [route, events]);

  // Al cambiar tamaño (fullscreen ↔ normal) MapLibre necesita un resize.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const id = window.setTimeout(() => map.resize(), 60);
    return () => window.clearTimeout(id);
  }, [fullscreen]);

  const toggleFullscreen = useCallback(() => setFullscreen(v => !v), []);

  const detail = selected
    ? (() => {
        const {ev} = selected;
        const lvl = severityLevel(ev.type, ev.severity);
        return {
          label: EVENT_LABEL[ev.type] ?? ev.type,
          color: EVENT_COLOR[ev.type] ?? '#64748B',
          sev: severityText(ev.type, ev.severity),
          lvl,
          when: new Date(ev.timestamp).toLocaleTimeString('es-PE', {hour: '2-digit', minute: '2-digit', second: '2-digit'}),
          blurb: EVENT_BLURB[ev.type] ?? 'Evento de riesgo detectado.',
        };
      })()
    : null;

  // ── Contenido del mapa (reutilizado en modo normal y fullscreen) ──
  const mapSurface = (
    <div className={`relative w-full ${fullscreen ? 'flex-grow min-h-0' : ''}`}>
      {/* Altura EXPLÍCITA en el contenedor: MapLibre le pone position:relative, así
          que `absolute inset-0` colapsaba a 0. Con height directo siempre mide bien. */}
      <div
        ref={containerRef}
        className="w-full rounded overflow-hidden bg-default-100"
        style={{height: fullscreen ? '100%' : height}}
      />

      {/* Botón fullscreen / salir */}
      <button
        type="button"
        onClick={toggleFullscreen}
        aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        className="btn btn-icon absolute top-3 left-3 z-10 bg-card/95 backdrop-blur border border-default-200 text-default-700 hover:text-primary shadow-sm">
        {fullscreen ? <LuMinimize className="size-4" /> : <LuMaximize className="size-4" />}
      </button>

      {fullscreen && (
        <button
          type="button"
          onClick={() => setFullscreen(false)}
          aria-label="Cerrar pantalla completa"
          className="btn btn-icon absolute top-3 left-14 z-10 bg-card/95 backdrop-blur border border-default-200 text-default-700 hover:text-danger shadow-sm">
          <LuX className="size-4" />
        </button>
      )}

      {/* Tarjeta de detalle del evento seleccionado */}
      {detail && (
        <div className="card absolute bottom-3 left-3 right-3 sm:right-auto sm:w-80 z-10 shadow-lg border border-default-200">
          <div className="card-body p-4">
            <div className="flex items-start gap-2.5">
              <span className="size-9 rounded grid place-items-center shrink-0 mt-0.5" style={{background: `${detail.color}1A`, color: detail.color}}>
                <LuTriangleAlert className="size-4.5" />
              </span>
              <div className="min-w-0 flex-grow">
                <div className="flex items-center gap-2">
                  <h6 className="font-semibold text-default-800 leading-tight">{detail.label}</h6>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="font-mono text-sm font-bold text-default-800">{detail.sev}</span>
                  <span className="inline-flex items-center py-0.5 px-2 rounded text-[11px] font-semibold" style={{background: `${detail.lvl.color}1A`, color: detail.lvl.color}}>
                    {detail.lvl.label}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Cerrar detalle"
                className="btn btn-icon size-7 -mt-1 -me-1 text-default-400 hover:text-default-700 shrink-0">
                <LuX className="size-4" />
              </button>
            </div>
            <p className="text-xs text-default-500 mt-2.5 pt-2.5 border-t border-default-200">{detail.blurb}</p>
            <p className="text-xs text-default-400 mt-1.5 font-mono">{detail.when}</p>
          </div>
        </div>
      )}
    </div>
  );

  if (!hasGeo) {
    return (
      <div className="card">
        <div className="w-full rounded grid place-items-center bg-default-50" style={{height}}>
          <div className="text-center">
            <div className="size-12 rounded-full bg-default-100 text-default-400 grid place-items-center mx-auto mb-3">
              <LuMapPinOff className="size-6" />
            </div>
            <p className="text-default-500 text-sm">Sin ruta registrada</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={fullscreen ? 'fixed inset-0 z-[1000] bg-card flex flex-col' : 'card'}>
      {mapSurface}

      <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 border-t border-default-200 ${fullscreen ? 'bg-card' : ''}`}>
        {LEGEND.map(l => (
          <span key={l.type} className="inline-flex items-center gap-1.5 text-xs text-default-600">
            <span className="size-2.5 rounded-full" style={{background: EVENT_COLOR[l.type]}} />
            {l.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-xs text-default-600">
          <span className="size-2.5 rounded-full" style={{background: START_COLOR}} />
          Inicio
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-default-600">
          <span className="size-2.5 rounded-full" style={{background: END_COLOR}} />
          Fin
        </span>
      </div>
    </div>
  );
}
