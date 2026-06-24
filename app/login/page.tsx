import { redirect } from "next/navigation";
import { Mail, ShieldCheck, UsersRound } from "lucide-react";
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
        <p className="institutional-slogan">
          <strong>Mejor transporte,</strong>
          <strong>mejores ciudades.</strong>
        </p>
        <LoginMobileMenu />
      </header>

      <div className="login-shell">
        <section className="login-panel" aria-label="Ingreso al sistema EGB Digital">
          <div className="login-copy">
            <div className="security-badge" aria-hidden="true">
              <ShieldCheck aria-hidden="true" size={20} strokeWidth={2} />
            </div>
            <div>
              <h1>Bienvenido</h1>
              <p className="lead">Ingresa para registrar y gestionar defectos de la flota del Sistema RED.</p>
            </div>
            <div className="login-copy-footer">
              <span aria-hidden="true">
                <UsersRound aria-hidden="true" size={20} strokeWidth={2} />
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
                  <Mail aria-hidden="true" size={20} strokeWidth={2} />
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
