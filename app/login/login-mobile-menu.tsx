"use client";

import { useEffect, useState } from "react";
import { CircleHelp, House, Menu, ShieldCheck, X } from "lucide-react";

export function LoginMobileMenu() {
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
    <div className="mobile-menu-root login-mobile-menu-root">
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
          <aside className="mobile-drawer login-mobile-drawer" aria-label="Menú de inicio de sesión">
            <div className="mobile-drawer-header">
              <div className="mobile-drawer-brand">
                <img src="/assets/logo-bus.png" alt="" />
                <span>Menú</span>
              </div>
              <button type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)}>
                <X aria-hidden="true" size={20} strokeWidth={2} />
              </button>
            </div>

            <nav className="side-nav" aria-label="Menú público">
              <button type="button" className="active" onClick={() => setOpen(false)}>
                <span className="nav-icon" aria-hidden="true">
                  <House aria-hidden="true" size={20} strokeWidth={2} />
                </span>
                <span>Inicio de sesión</span>
              </button>
              <button type="button" onClick={() => setOpen(false)}>
                <span className="nav-icon" aria-hidden="true">
                  <CircleHelp aria-hidden="true" size={20} strokeWidth={2} />
                </span>
                <span>Soporte</span>
              </button>
            </nav>
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
