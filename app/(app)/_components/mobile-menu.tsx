"use client";

import { useEffect, useState } from "react";
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
    return () => {
      document.body.style.overflow = "";
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
        <span />
        <span />
        <span />
      </button>

      {open ? (
        <div className="mobile-drawer-layer">
          <button className="mobile-drawer-backdrop" type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)} />
          <aside className="mobile-drawer" aria-label="Menú principal móvil">
            <div className="mobile-drawer-header">
              <span>Menú</span>
              <button type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <SidebarNav navigation={navigation} onNavigate={() => setOpen(false)} />

            <MobileUserBlock activeRole={user.activeRole} initials={initials} user={user} />
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
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14 8V5a2 2 0 0 0-2-2H5v18h7a2 2 0 0 0 2-2v-3" />
            <path d="M9 12h11" />
            <path d="m17 9 3 3-3 3" />
          </svg>
          <span>Cerrar Sesión</span>
        </button>
      </form>
    </div>
  );
}
