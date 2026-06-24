"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ClipboardCheck, ShieldCheck, UserRound, UserRoundPlus } from "lucide-react";
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
        <ChevronDown aria-hidden="true" size={20} strokeWidth={2} />
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
                {active ? <Check aria-hidden="true" className="profile-check" size={20} strokeWidth={2} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </form>
  );
}

function RoleIcon({ role }: { role: Role }) {
  switch (role) {
    case "Administrador":
      return <UserRoundPlus aria-hidden="true" size={20} strokeWidth={2} />;
    case "Autoridad":
      return <ShieldCheck aria-hidden="true" size={20} strokeWidth={2} />;
    case "Operador":
      return <UserRound aria-hidden="true" size={20} strokeWidth={2} />;
    case "Inspector":
      return <ClipboardCheck aria-hidden="true" size={20} strokeWidth={2} />;
  }
}
