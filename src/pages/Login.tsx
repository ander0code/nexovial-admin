import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {LuEye, LuEyeOff} from 'react-icons/lu';
import {api} from '@/api/client';
import {saveSession} from '@/auth';

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

  return (
    <div className="min-h-screen grid place-items-center bg-default-50 px-6">
      <div className="w-full max-w-md">
        <div className="card">
          <div className="card-body p-10">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold tracking-tight">
                NEXO<span className="text-primary">VIAL</span>
              </h1>
              <p className="text-xs uppercase tracking-widest text-primary font-semibold mt-2">
                Centro de control de flota
              </p>
              <p className="text-sm text-default-500 mt-1">Prevención que premia.</p>
            </div>

            <form onSubmit={submit} className="flex flex-col gap-5">
              <div>
                <label htmlFor="email" className="form-label">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="form-input rounded mt-1.5"
                  placeholder="admin@tuempresa.pe"
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="form-label">Contraseña</label>
                <div className="relative mt-1.5">
                  <input
                    id="password"
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="form-input rounded pe-11"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShow(s => !s)}
                    className="absolute inset-y-0 end-0 flex items-center pe-3.5 text-default-500 hover:text-primary"
                    aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                    {show ? <LuEyeOff className="size-4.5" /> : <LuEye className="size-4.5" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-danger" role="alert">{error}</p>
              )}

              <button type="submit" disabled={loading} className="btn bg-primary text-white hover:bg-primary/90 btn-lg disabled:opacity-60">
                {loading ? 'Verificando…' : 'Ingresar al panel'}
              </button>
            </form>
          </div>
        </div>
        <p className="text-center text-xs text-default-400 mt-5 font-medium tracking-wide">NEXOVIAL · LIMA, PE</p>
      </div>
    </div>
  );
}
