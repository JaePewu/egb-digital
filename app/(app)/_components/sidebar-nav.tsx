"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavigationItem } from "@/lib/access";
import { AppIcon } from "./app-icon";

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
              <AppIcon name={item.key} />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
