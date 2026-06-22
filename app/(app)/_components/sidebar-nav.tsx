"use client";

import Link from "next/link";
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
              <NavIcon type={item.key} />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function NavIcon({ type }: { type: ModuleKey }) {
  switch (type) {
    case "inicio":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5.5 10.5V20h13v-9.5" />
          <path d="M9.5 20v-5h5v5" />
        </svg>
      );
    case "defecto-puntual":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
        </svg>
      );
    case "revision-pauta":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M8 4h8l1 2h3v15H4V6h3l1-2Z" />
          <path d="m8 13 2 2 5-5" />
          <path d="M8 18h8" />
        </svg>
      );
    case "historial":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M7 3h10v18H7V3Z" />
          <path d="M10 8h4" />
          <path d="M10 12h4" />
          <path d="M10 16h2" />
        </svg>
      );
    case "notificaciones":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
      );
    case "reportes":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M4 19h16" />
          <path d="M7 16V9" />
          <path d="M12 16V5" />
          <path d="M17 16v-4" />
        </svg>
      );
    case "administracion":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M16 21v-2a4 4 0 0 0-8 0v2" />
          <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
          <path d="M19 8v4" />
          <path d="M21 10h-4" />
        </svg>
      );
    case "datos-maestros":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M4 6c0-1.1 3.6-2 8-2s8 .9 8 2-3.6 2-8 2-8-.9-8-2Z" />
          <path d="M4 6v6c0 1.1 3.6 2 8 2s8-.9 8-2V6" />
          <path d="M4 12v6c0 1.1 3.6 2 8 2s8-.9 8-2v-6" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24">
          <path d="M5 12h14" />
        </svg>
      );
  }
}
