import {Link, useLocation} from 'react-router-dom';
import {LuLayoutDashboard, LuTrophy, LuBellRing, LuUsers} from 'react-icons/lu';
import type {IconType} from 'react-icons';

type NavItem = {label: string; href: string; icon: IconType};

const NAV: NavItem[] = [
  {label: 'Resumen', href: '/resumen', icon: LuLayoutDashboard},
  {label: 'Ranking', href: '/rankings', icon: LuTrophy},
  {label: 'Alertas', href: '/alerts', icon: LuBellRing},
  {label: 'Conductores', href: '/drivers', icon: LuUsers},
];

export default function Sidebar() {
  const {pathname} = useLocation();

  return (
    <aside id="app-menu" className="app-menu">
      <Link
        to="/resumen"
        className="logo-box sticky top-0 z-10 flex min-h-topbar-height items-center justify-start px-6 bg-(--sidenav-background)">
        <span className="text-2xl font-bold tracking-tight">
          NEXO<span className="text-primary">VIAL</span>
        </span>
      </Link>

      <div className="relative min-h-0 flex-grow overflow-y-auto">
        <ul className="side-nav px-3 pt-2">
          <li className="menu-title">Menú</li>
          {NAV.map(item => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className={`menu-item ${active ? 'active' : ''}`}>
                <Link to={item.href} className={`menu-link ${active ? 'active' : ''}`}>
                  <span className="menu-icon">
                    <Icon />
                  </span>
                  <div className="menu-text">{item.label}</div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="px-6 py-4 text-xs text-default-500">MVP · Innovation Challenge</div>
    </aside>
  );
}
