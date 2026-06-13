import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3777';

export const api = axios.create({baseURL: API_URL});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('nexovial:token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('nexovial:token');
      localStorage.removeItem('nexovial:admin');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

// ── Tipos de las respuestas del nexovial-api ──────────────────────────────

export type Admin = {id: string; name: string; companyId: string};

export type RankingEntry = {
  driverId: string;
  name: string;
  code: string;
  score: number | null;
  bonusLevel: 1 | 2 | null;
  trips: number;
  totalKm: number;
  events: number;
  eventRate: number | null;
};

export type Alert = {
  id?: string;
  tripId?: string;
  driverId: string;
  driverName: string;
  type: string;
  severity: number;
  lat: number | null;
  lng: number | null;
  timestamp: string;
};

export type VehicleType = 'SEDAN' | 'SUV' | 'VAN' | 'PICKUP' | 'TRUCK' | 'BUS' | 'MOTORCYCLE';

export type Vehicle = {
  plate: string;
  type: VehicleType;
  brand: string | null;
  model: string | null;
  year?: number | null;
};

export type ShiftKind = 'WORK' | 'BREAK';

export type ScheduleBlock = {
  dayOfWeek: number; // 0=domingo … 6=sábado
  startMin: number; // minutos desde medianoche
  endMin: number;
  kind: ShiftKind;
};

export type DriverSummary = {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  createdAt: string;
  vehicle: Vehicle | null;
  trips: number;
  /** Promedio rolling de score (últimos 30 días, withinShift). null = sin viajes. */
  score: number | null;
};

export type RoutePoint = {lat: number; lng: number};

export type TripDetail = {
  id: string;
  startTime: string;
  endTime: string;
  score: number;
  distance: number;
  withinShift: boolean;
  route: RoutePoint[] | null;
  events: Array<{
    type: string;
    severity: number;
    lat: number | null;
    lng: number | null;
    timestamp: string;
  }>;
};

export type DriverDetail = {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  dni: string | null;
  license: string | null;
  vehicle: Vehicle | null;
  schedule: ScheduleBlock[];
  trips: TripDetail[];
};

// ── Mapa de flota (GET /api/admin/fleet/map) ─────────────────────────────────

export type FleetTrip = {
  id: string;
  startTime: string;
  endTime: string;
  score: number;
  distance: number;
  withinShift: boolean;
  route: RoutePoint[] | null;
  events: TripDetail['events'];
};

export type FleetDriver = {
  id: string;
  name: string;
  code: string;
  vehicle: {plate: string; type: VehicleType} | null;
  score: number | null;
  /** true = dentro de un bloque WORK de su horario en este momento (hora Lima). */
  onShiftNow: boolean;
  /** Hora del último viaje de todos los tiempos (no del rango). null = nunca manejó. */
  lastTripEndTime: string | null;
  trips: FleetTrip[];
};

export type FleetMapResponse = {
  from: string;
  to: string;
  drivers: FleetDriver[];
};

// ── Alta de conductor (POST /api/admin/drivers) ──────────────────────────────

export type NewDriverInput = {
  name: string;
  phone?: string;
  dni?: string;
  license?: string;
  code?: string; // opcional: si no se manda, el servidor genera uno
  vehicle?: {
    plate: string;
    type: VehicleType;
    brand?: string;
    model?: string;
    year?: number;
  };
  schedule?: ScheduleBlock[];
};

export type CreatedDriver = {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  dni: string | null;
  license: string | null;
  vehicle: Vehicle | null;
  schedule: ScheduleBlock[];
};

/** Crea un conductor con persona + vehículo + horario en una sola llamada. */
export async function createDriver(input: NewDriverInput): Promise<CreatedDriver> {
  const {data} = await api.post('/api/admin/drivers', input);
  return data as CreatedDriver;
}
