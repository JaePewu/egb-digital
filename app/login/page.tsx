import { redirect } from "next/navigation";
import { getDefaultPathForUser } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { LoginMobileMenu } from "./login-mobile-menu";
import { PasswordField } from "./password-field";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();
  if (user) redirect(getDefaultPathForUser(user));

  const params = await searchParams;
  const error = params?.error;

  return (
    <main className="login-page">
      <header className="institutional-header">
        <div className="institutional-brand">
          <img src="/assets/logo-bus.png" alt="Logo bus EGB Digital" />
          <div>
            <strong>EGB Digital - Sistema RED</strong>
            <span>DTPM - Dirección de Transporte Público Metropolitano</span>
          </div>
        </div>
        <p>Mejor transporte, mejores ciudades.</p>
        <LoginMobileMenu />
      </header>

      <div className="login-shell">
        <section className="login-panel" aria-label="Ingreso al sistema EGB Digital">
          <div className="login-copy">
            <div className="security-badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M12 3 5.5 5.6v5.3c0 4.1 2.7 7.8 6.5 9.1 3.8-1.3 6.5-5 6.5-9.1V5.6L12 3Z" />
                <path d="m9 12 2 2 4-5" />
              </svg>
            </div>
            <div>
              <h1>Bienvenido</h1>
              <p className="lead">Ingresa para registrar y gestionar defectos de la flota del Sistema RED.</p>
            </div>
            <div className="login-copy-footer">
              <span aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M7 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                  <path d="M17 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                  <path d="M2.5 20a4.5 4.5 0 0 1 9 0" />
                  <path d="M12.5 20a4.5 4.5 0 0 1 9 0" />
                </svg>
              </span>
              <p>Plataforma institucional para la mejora continua del transporte público.</p>
            </div>
          </div>

          <form className="login-form" action="/api/login" method="post">
            <h2>Iniciar sesión</h2>
            <label>
              Correo institucional
              <div className="input-frame">
                <span className="input-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M4 6h16v12H4V6Z" />
                    <path d="m4 7 8 6 8-6" />
                  </svg>
                </span>
                <input
                  name="correo"
                  type="email"
                  autoComplete="email"
                  placeholder="usuario@institucion.cl"
                  required
                />
              </div>
            </label>
            <label>
              Contraseña
              <PasswordField />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="login-submit" type="submit">
              Iniciar sesión
            </button>
            <div className="login-links" aria-label="Enlaces de ayuda">
              <button type="button">¿Olvidaste tu contraseña?</button>
              <span aria-hidden="true" />
              <button type="button">Soporte</button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
