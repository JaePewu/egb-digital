"use client";

import { useEffect, useRef, useState } from "react";
import type { Role } from "@/lib/access";

type ProfileSwitcherProps = {
  activeRole: Role;
  roles: Role[];
};

export function ProfileSwitcher({ activeRole, roles }: ProfileSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <form ref={rootRef} className="sidebar-profile-form" action="/api/perfil-activo" method="post">
      <button
        type="button"
        className="profile-pill profile-pill-button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{activeRole}</span>
        <ChevronIcon />
      </button>

      {open ? (
        <div className="profile-menu" role="menu">
          {roles.map((role) => {
            const active = role === activeRole;

            return (
              <button
                className={active ? "active" : undefined}
                key={role}
                name="perfil"
                type="submit"
                value={role}
                role="menuitem"
                onClick={(event) => {
                  if (active) {
                    event.preventDefault();
                    setOpen(false);
                  }
                }}
              >
                <RoleIcon role={role} />
                <span>{role}</span>
                {active ? <CheckIcon /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </form>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m6 8 4 4 4-4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="profile-check" viewBox="0 0 20 20" aria-hidden="true">
      <path d="m5 10 3 3 7-7" />
    </svg>
  );
}

function RoleIcon({ role }: { role: Role }) {
  switch (role) {
    case "Administrador":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-8 0v2" />
          <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
          <path d="M19 8v4" />
          <path d="M21 10h-4" />
        </svg>
      );
    case "Autoridad":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
          <path d="m9 12 2 2 4-5" />
        </svg>
      );
    case "Operador":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-8 0v2" />
          <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        </svg>
      );
    case "Inspector":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 4h8l1 2h3v15H4V6h3l1-2Z" />
          <path d="m8 13 2 2 5-5" />
        </svg>
      );
  }
}
