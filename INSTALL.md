# nexovial-admin — Instalación

Dashboard del administrador de flota (rankings, alertas en tiempo real, conductores, mapas de viajes).

## Qué usa
- **Node.js 20+** · gestor de paquetes **pnpm** (NO npm)
- **React + Vite** + **TypeScript**
- **Tailwind CSS v4** (`@tailwindcss/vite`)
- **MapLibre GL** (mapas de los viajes) · **ApexCharts** (gráficos)
- **react-router-dom** · **socket.io-client** (alertas en vivo) · **axios** · **react-icons**

## Requisitos previos
- Node 20+, pnpm (`npm i -g pnpm`)
- El **nexovial-api** corriendo (este dashboard lo consume)

## Pasos
```bash
pnpm install

# 1) Variables de entorno
cp .env.example .env
#   VITE_API_URL="http://localhost:3777"   ← URL del nexovial-api

# 2) Levantar
pnpm dev                 # http://localhost:5377
```

## Scripts
| Script | Qué hace |
|---|---|
| `pnpm dev` | servidor de desarrollo (puerto 5377) |
| `pnpm build` | `tsc -b && vite build` → `dist/` |
| `pnpm preview` | sirve el build de producción |
| `pnpm lint` | ESLint |

## Notas
- Puerto oficial del dashboard: **5377** (5173 está ocupado por otros proyectos).
- Necesita el API arriba para mostrar datos; las alertas llegan por Socket.io.
