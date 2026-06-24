"use client";

import Link from "next/link";
import {
  BarChart3,
  Bell,
  CirclePlus,
  ClipboardCheck,
  Database,
  History,
  House,
  SquareCheckBig,
  UserRoundPlus,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import type { ModuleKey, NavigationItem } from "@/lib/access";

type SidebarNavProps = {
  navigation: NavigationItem[];
  onNavigate?: () => void;
};

export function SidebarNav({ navigation, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="side-nav" aria-label="Navegacion principal">
      {navigation.map((item) => {
        const active = item.href === "/inicio" ? pathname === item.href : pathname.startsWith(item.href);

        return (
          <Link className={active ? "active" : undefined} href={item.href} key={item.key} onClick={onNavigate}>
            <span className="nav-icon" aria-hidden="true">
              <NavigationIcon moduleKey={item.key} />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

const navigationIcons: Record<ModuleKey, LucideIcon> = {
  inicio: House,
  "defecto-puntual": CirclePlus,
  "revision-pauta": ClipboardCheck,
  historial: History,
  notificaciones: Bell,
  reportes: BarChart3,
  "resolver-defectos": SquareCheckBig,
  administracion: UserRoundPlus,
  "datos-maestros": Database,
};

function NavigationIcon({ moduleKey }: { moduleKey: ModuleKey }) {
  const Icon = navigationIcons[moduleKey];
  return <Icon aria-hidden="true" size={20} strokeWidth={2} />;
}
