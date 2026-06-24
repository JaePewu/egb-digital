"use client";

import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";

export function PasswordField() {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="input-frame">
      <span className="input-icon" aria-hidden="true">
        <LockKeyhole aria-hidden="true" size={20} strokeWidth={2} />
      </span>
      <input
        name="contrasena"
        type={isVisible ? "text" : "password"}
        autoComplete="current-password"
        placeholder="Ingresa tu contraseña"
        required
      />
      <button
        aria-label={isVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={isVisible}
        className="password-toggle"
        type="button"
        onClick={() => setIsVisible((current) => !current)}
      >
        {isVisible ? (
          <EyeOff aria-hidden="true" size={20} strokeWidth={2} />
        ) : (
          <Eye aria-hidden="true" size={20} strokeWidth={2} />
        )}
      </button>
    </div>
  );
}
