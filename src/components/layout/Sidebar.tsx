import {Link, useLocation, useNavigate} from 'react-router-dom';
import {LuLayoutDashboard, LuMap, LuTrophy, LuBellRing, LuUsers, LuLogOut, LuSun, LuMoon} from 'react-icons/lu';
import type {IconType} from 'react-icons';
import {getAdmin, clearSession} from '@/auth';
import {useTheme} from '@/useTheme';

type NavItem = {label: string; href: string; icon: IconType};

const NAV: NavItem[] = [
  {label: 'Resumen', href: '/resumen', icon: LuLayoutDashboard},
  {label: 'Mapa', href: '/mapa', icon: LuMap},
  {label: 'Ranking', href: '/rankings', icon: LuTrophy},
  {label: 'Alertas', href: '/alerts', icon: LuBellRing},
  {label: 'Conductores', href: '/drivers', icon: LuUsers},
];

function initials(name?: string | null): string {
  if (!name) return 'NV';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'NV';
}

export default function Sidebar() {
  const {pathname} = useLocation();
  const navigate = useNavigate();
  const {theme, toggle} = useTheme();
  const admin = getAdmin();

  const signOut = () => {
    clearSession();
    navigate('/login', {replace: true});
  };

  return (
    <aside id="app-menu" className="app-menu flex flex-col gap-6 px-5 py-6">
      {/* Logo */}
      <Link to="/resumen" className="flex items-center gap-2.5 px-1">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-base font-extrabold text-white">N</span>
        <span className="text-xl font-extrabold tracking-tight text-default-900">
          Nexo<span className="text-primary">Vial</span>
        </span>
      </Link>

      {/* Perfil del admin */}
      <div className="flex flex-col items-center pt-1 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-default-200 text-lg font-bold text-default-700">
          {initials(admin?.name)}
        </span>
        <p className="mt-3 font-bold text-default-900">{admin?.name ?? 'Administrador'}</p>
        <p className="text-sm text-default-500">Administrador de flota</p>
      </div>

      <hr className="border-default-200" />

      {/* Navegación principal — minimalista: activo = negrita + ícono azul, sin píldora */}
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {NAV.map(item => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-colors ${
                active
                  ? 'bg-card font-bold text-default-900 shadow-[0_2px_12px_-6px_rgb(15_23_42/0.15)]'
                  : 'font-medium text-default-500 hover:bg-card/60 hover:text-default-800'
              }`}>
              <Icon className={`size-[18px] shrink-0 ${active ? 'text-primary' : 'text-default-400 group-hover:text-default-600'}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Sección secundaria: tema + cerrar sesión */}
      <div className="flex flex-col gap-1">
        <hr className="mb-1 border-default-200" />
        <button
          onClick={toggle}
          className="flex items-center justify-between rounded-xl px-3 py-2.5 text-[15px] font-medium text-default-500 transition-colors hover:bg-card/60 hover:text-default-800">
          <span className="flex items-center gap-3">
            {theme === 'dark' ? <LuMoon className="size-[18px] text-default-400" /> : <LuSun className="size-[18px] text-default-400" />}
            Tema {theme === 'dark' ? 'oscuro' : 'claro'}
          </span>
          <span className={`relative h-5 w-9 rounded-full transition-colors ${theme === 'dark' ? 'bg-primary' : 'bg-default-300'}`}>
            <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-all ${theme === 'dark' ? 'start-[18px]' : 'start-0.5'}`} />
          </span>
        </button>
        <button
          onClick={signOut}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-default-500 transition-colors hover:bg-danger/5 hover:text-danger">
          <LuLogOut className="size-[18px] shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
