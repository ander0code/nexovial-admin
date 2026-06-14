import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {
  LuEye,
  LuEyeOff,
  LuMail,
  LuLock,
  LuShieldCheck,
  LuTrophy,
  LuRadar,
  LuArrowRight,
  LuTriangleAlert,
} from 'react-icons/lu';
import {api} from '@/api/client';
import {saveSession} from '@/auth';
import LoginHeroMap from '@/components/LoginHeroMap';

const FEATURES = [
  {icon: LuShieldCheck, title: 'Telemática propia', desc: 'Tus datos no salen de tu servidor.'},
  {icon: LuTrophy, title: 'Score que premia', desc: 'Reconoce a tus mejores conductores.'},
  {icon: LuRadar, title: 'Riesgo en tiempo real', desc: 'Recorridos y alertas en un mapa vivo.'},
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const {data} = await api.post('/api/admin/auth', {email, password});
      saveSession(data.token, data.admin);
      navigate('/resumen');
    } catch {
      setError('Credenciales incorrectas. Verifica tu email y contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-default-200 bg-card py-3 ps-11 pe-4 text-default-900 placeholder:text-default-400 transition-colors focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15';

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ── Izquierda: panel de marca (oscuro siempre) ── */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-12 text-white lg:flex">
        {/* Fondo animado: vehículo recorriendo la ruta GPS + telemetría en vivo */}
        <LoginHeroMap />

        {/* Logo */}
        <div className="relative flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-lg font-extrabold text-white">N</span>
          <span className="text-xl font-extrabold tracking-tight">
            Nexo<span className="text-[#6aa9ec]">Vial</span>
          </span>
        </div>

        {/* Hero */}
        <div className="relative max-w-md">
          <h2 className="text-4xl font-extrabold leading-[1.1] tracking-tight">Prevención que premia.</h2>
          <p className="mt-4 text-lg text-white/60">
            El centro de control de tu flota: scoring, alertas y recorridos en un solo lugar.
          </p>
          <ul className="mt-10 space-y-5">
            {FEATURES.map(f => (
              <li key={f.title} className="flex items-start gap-3.5">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-white/10 text-[#6aa9ec]">
                  <f.icon className="size-[18px]" />
                </span>
                <span>
                  <span className="block font-semibold">{f.title}</span>
                  <span className="block text-sm text-white/50">{f.desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="relative text-sm text-white/40">© 2026 NexoVial · Lima, PE</p>
      </aside>

      {/* ── Derecha: formulario ── */}
      <main className="flex items-center justify-center bg-default-50 px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Logo en móvil (el panel de marca se oculta) */}
          <div className="mb-10 flex items-center justify-center gap-2.5 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-lg font-extrabold text-white">N</span>
            <span className="text-xl font-extrabold tracking-tight text-default-900">
              Nexo<span className="text-primary">Vial</span>
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-default-900">Bienvenido de vuelta</h1>
          <p className="mt-1.5 text-sm text-default-500">Ingresa a tu centro de control de flota.</p>

          <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-default-700">
                Email
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-default-400">
                  <LuMail className="size-[18px]" />
                </span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="admin@tuempresa.pe"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-default-700">
                Contraseña
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-default-400">
                  <LuLock className="size-[18px]" />
                </span>
                <input
                  id="password"
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={`${inputClass} pe-11`}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  className="absolute inset-y-0 end-0 flex items-center pe-3.5 text-default-400 transition-colors hover:text-primary"
                  aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  {show ? <LuEyeOff className="size-[18px]" /> : <LuEye className="size-[18px]" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="flex items-center gap-2 rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger"
                role="alert">
                <LuTriangleAlert className="size-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-semibold text-white shadow-[0_8px_24px_-10px_rgb(21_101_216/0.7)] transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? (
                'Verificando…'
              ) : (
                <>
                  Ingresar al panel
                  <LuArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-default-400">
            NexoVial · Prevención que premia · Lima, PE
          </p>
        </div>
      </main>
    </div>
  );
}
