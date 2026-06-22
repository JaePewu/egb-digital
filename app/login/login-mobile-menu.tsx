"use client";

import { useEffect, useState } from "react";

export function LoginMobileMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
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
        <span />
        <span />
        <span />
      </button>

      {open ? (
        <div className="mobile-drawer-layer">
          <button className="mobile-drawer-backdrop" type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)} />
          <aside className="mobile-drawer login-mobile-drawer" aria-label="Menú de inicio de sesión">
            <div className="mobile-drawer-header">
              <span>Menú</span>
              <button type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <nav className="side-nav" aria-label="Menú público">
              <button type="button" className="active" onClick={() => setOpen(false)}>
                <span className="nav-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M3 11.5 12 4l9 7.5" />
                    <path d="M5.5 10.5V20h13v-9.5" />
                    <path d="M9.5 20v-5h5v5" />
                  </svg>
                </span>
                <span>Inicio de sesión</span>
              </button>
              <button type="button" onClick={() => setOpen(false)}>
                <span className="nav-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 18h.01" />
                    <path d="M9.1 9a3 3 0 1 1 5.8 1c-.4 1.2-1.7 1.7-2.3 2.6-.4.5-.6 1-.6 1.9" />
                    <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" />
                  </svg>
                </span>
                <span>Soporte</span>
              </button>
            </nav>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
