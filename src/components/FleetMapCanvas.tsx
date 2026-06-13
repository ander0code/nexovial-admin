import {useEffect, useRef, useState} from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
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
  const firstFitRef = useRef(true);
  // Ref para que el handler de clic del marcador no quede con un onSelect viejo.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const [ready, setReady] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.dataset.theme === 'dark');

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
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({showCompass: false}), 'top-right');
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
      // Clic en el lienzo (no en un marcador) deselecciona.
      map.on('click', () => onSelectRef.current(null));
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

    // Marcadores de evento (solo del conductor seleccionado)
    for (const m of eventMarkersRef.current) m.remove();
    eventMarkersRef.current = [];
    if (selectedId) {
      const sel = drivers.find(d => d.id === selectedId);
      for (const t of sel?.trips ?? []) {
        for (const ev of t.events) {
          if (typeof ev.lat !== 'number' || typeof ev.lng !== 'number') continue;
          const dot = document.createElement('div');
          dot.style.cssText =
            'width:13px;height:13px;border-radius:9999px;border:2px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,.4);';
          dot.style.background = EVENT_COLOR[ev.type] ?? '#64748B';
          const m = new maplibregl.Marker({element: dot}).setLngLat([ev.lng, ev.lat]).addTo(map);
          eventMarkersRef.current.push(m);
        }
      }
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

  return (
    <div
      ref={containerRef}
      className="size-full overflow-hidden rounded-2xl border border-default-200 bg-default-100 shadow-[0_6px_28px_-14px_rgb(15_23_42/0.22)] dark:shadow-none"
    />
  );
}

/** Marcador de conductor: círculo con iniciales, color por score, anillo si está en turno. */
function buildMarkerEl({
  label,
  color,
  onShift,
  selected,
  dimmed,
  dark,
}: {
  label: string;
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
  return wrap;
}
