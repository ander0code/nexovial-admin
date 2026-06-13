# CLAUDE.md — nexovial-admin

Dashboard web del administrador de flota. Lee datos del nexovial-api y muestra ranking,
alertas en tiempo real e historial de conductores.

Contexto completo → `../docs/PRODUCT_CONTEXT.md` y `../docs/TECHNICAL_DECISIONS.md`

---

## Responsabilidad de este módulo

Interfaz web que usa el jefe de flota desde su laptop u oficina.
Solo consume datos — no tiene lógica de negocio propia.
Toda la lógica de scoring y bonos vive en nexovial-api.

---

## Sistema de diseño

Tema CLARO pastel profesional (decisión del usuario, junio 2026): lienzo azul
pastel `#F3F7FB`, tarjetas blancas con sombra suave, y la regla de oro —
**pasteles solo como superficies** (badges, hovers, fondos, atmósfera);
**azul `#2570B8` y verde `#1F8A5F` profundos para texto y CTAs** (contraste
AA 4.5:1; pastel-sobre-pastel está prohibido por accesibilidad).

Tokens CSS en `src/index.css` (`:root`). Tipografía: `--font-ui` Archivo +
`--font-mono` JetBrains Mono (datos, códigos, labels). Las fuentes se cargan
en `index.html` (Google Fonts, variable). Reglas: inputs custom con
`appearance: none` y estados focus/error propios (anillo `--ring`), nunca
quitar `:focus-visible` sin reemplazo, números tabulares en tablas,
`prefers-reduced-motion` respetado, SVG para iconos (nunca emojis).
La app móvil del conductor se mantiene OSCURA a propósito (uso nocturno al volante).

---

## Páginas

| Página | Ruta | Qué muestra |
|---|---|---|
| Resumen | `/resumen` | KPIs de flota (score, viajes, km, alertas 30d) + chart de eventos por día (ApexCharts) + donut por tipo + top 3 conductores. Es la landing tras el login. Consume GET /api/admin/summary |
| Rankings | `/rankings` | Tabla de conductores ordenada por score del período |
| Alertas | `/alerts` | Feed en tiempo real de eventos de riesgo severos |
| Conductores | `/drivers` | Lista de conductores, código QR para onboarding |
| Detalle conductor | `/drivers/:id` | Historial de viajes y score histórico |

---

## API que consume

Base URL: `http://localhost:3777` en desarrollo / URL del servidor en producción
(Puertos propios de NexoVial: API 3777, dashboard 5377 — los default están ocupados)

Ver rutas completas en `../nexovial-api/CLAUDE.md` sección "Rutas admin".

---

## Real-time con Socket.io

```typescript
// Conectar al servidor de nexovial-api
const socket = io('http://localhost:3777')
// y unirse al room de la empresa (las alertas son por empresa):
socket.emit('join_company', companyId)

// Escuchar nuevas alertas
socket.on('new_alert', (alert) => {
  // mostrar notificación en el dashboard
})

// Escuchar nuevos viajes sincronizados
socket.on('trip_synced', (trip) => {
  // actualizar el ranking si corresponde
})
```

---

## Variables de entorno

```env
VITE_API_URL="http://localhost:3777"
```

---

## Comandos

Este módulo usa **pnpm** (no npm).

```bash
pnpm install
pnpm dev      # http://localhost:5377
pnpm build    # build de producción (tsc + vite build)
```

Login demo: `admin@flotademo.pe` / `NexoVial2026!` (seed del nexovial-api)
