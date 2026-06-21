"use client";

import { useState } from "react";

export function PasswordField() {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="input-frame">
      <span className="input-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M17 10H7V8a5 5 0 0 1 10 0v2Z" />
          <path d="M6 10h12v10H6V10Z" />
          <path d="M12 14v3" />
        </svg>
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
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M3 3l18 18" />
            <path d="M10.7 10.7a2 2 0 0 0 2.6 2.6" />
            <path d="M9.1 5.2A9.7 9.7 0 0 1 12 4.8c5 0 8.5 4.1 9.7 6.9a13.3 13.3 0 0 1-2.4 3.5" />
            <path d="M6.4 6.8A13.5 13.5 0 0 0 2.3 11.7c1.2 2.8 4.7 6.9 9.7 6.9a9.7 9.7 0 0 0 4.4-1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M2.3 12s3.6-6.7 9.7-6.7S21.7 12 21.7 12s-3.6 6.7-9.7 6.7S2.3 12 2.3 12Z" />
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          </svg>
        )}
      </button>
    </div>
  );
}
