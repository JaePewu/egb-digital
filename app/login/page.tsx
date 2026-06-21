import { redirect } from "next/navigation";
import { getDefaultPathForUser } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";

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
    <main className="login-shell">
      <section className="login-panel">
        <div className="login-copy">
          <p className="eyebrow">EGB Digital MVP</p>
          <h1>Ingreso local</h1>
          <p className="lead">
            Accede con usuarios semilla para validar roles, permisos y navegacion inicial.
          </p>
        </div>

        <form className="login-form" action="/api/login" method="post">
          <label>
            Correo
            <input
              name="correo"
              type="email"
              autoComplete="email"
              placeholder="ana.martinez@egb.local"
              required
            />
          </label>
          <label>
            Contrasena
            <input
              name="contrasena"
              type="password"
              autoComplete="current-password"
              placeholder="pass123"
              required
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit">Ingresar</button>
        </form>
      </section>
    </main>
  );
}
