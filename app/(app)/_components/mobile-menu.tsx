"use client";

import { useEffect, useState } from "react";
import { LogOut, Menu, ShieldCheck, X } from "lucide-react";
import { getPrimaryRole, type NavigationItem, type Role, type SessionUser } from "@/lib/access";
import { ProfileSwitcher } from "./profile-switcher";
import { SidebarNav } from "./sidebar-nav";

type MobileMenuProps = {
  initials: string;
  navigation: NavigationItem[];
  user: SessionUser;
};

export function MobileMenu({ initials, navigation, user }: MobileMenuProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="mobile-menu-root">
      <button
        type="button"
        className="mobile-menu-trigger"
        aria-label="Abrir menú"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu aria-hidden="true" size={20} strokeWidth={2} />
      </button>

      {open ? (
        <div className="mobile-drawer-layer">
          <button className="mobile-drawer-backdrop" type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)} />
          <aside className="mobile-drawer" aria-label="Menú principal móvil">
            <div className="mobile-drawer-header">
              <div className="mobile-drawer-brand">
                <img src="/assets/logo-bus.png" alt="" />
                <span>Menú principal</span>
              </div>
              <button type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)}>
                <X aria-hidden="true" size={20} strokeWidth={2} />
              </button>
            </div>

            <SidebarNav navigation={navigation} onNavigate={() => setOpen(false)} />

            <MobileUserBlock activeRole={user.activeRole} initials={initials} user={user} />

            <div className="security-note">
              <ShieldCheck aria-hidden="true" size={20} strokeWidth={2} />
              <span>Acceso seguro y confidencial.</span>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function MobileUserBlock({
  activeRole,
  initials,
  user,
}: {
  activeRole: Role;
  initials: string;
  user: SessionUser;
}) {
  return (
    <div className="sidebar-footer mobile-sidebar-footer">
      <div className="sidebar-user">
        <div className="user-avatar" aria-hidden="true">
          {initials}
        </div>
        <div className="sidebar-user-data">
          <span className="user-name">{user.nombreCompleto}</span>
          <span className="user-email mobile-user-email">{user.correo}</span>
          {user.roles.length > 1 ? (
            <ProfileSwitcher activeRole={activeRole} roles={user.roles} />
          ) : (
            <div className="profile-pill role-chip">{getPrimaryRole(user)}</div>
          )}
        </div>
      </div>
      <form action="/api/logout" method="post" className="logout-form">
        <button type="submit">
          <LogOut aria-hidden="true" size={20} strokeWidth={2} />
          <span>Cerrar Sesión</span>
        </button>
      </form>
    </div>
  );
}
