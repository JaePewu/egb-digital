import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccessScopeLabel, getNavigationForUser, getPrimaryRole } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const navigation = getNavigationForUser(user);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span>EGB</span>
          <strong>Digital</strong>
        </div>

        <nav className="side-nav" aria-label="Navegacion principal">
          {navigation.map((item) => (
            <Link href={item.href} key={item.key}>
              {item.label}
            </Link>
          ))}
        </nav>

        <form action="/api/logout" method="post" className="logout-form">
          <button type="submit">Cerrar sesion</button>
        </form>
      </aside>

      <div className="content-area">
        <header className="topbar">
          <div>
            <span className="user-name">{user.nombreCompleto}</span>
            <small>{user.correo}</small>
          </div>
          <div className="role-chip">{getPrimaryRole(user)}</div>
        </header>
        <p className="scope-note">{getAccessScopeLabel(user)}</p>
        {children}
      </div>
    </div>
  );
}
