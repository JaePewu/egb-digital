import { redirect } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { getNavigationForUser, getPrimaryRole } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { MobileMenu } from "./_components/mobile-menu";
import { ProfileSwitcher } from "./_components/profile-switcher";
import { SidebarNav } from "./_components/sidebar-nav";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const navigation = getNavigationForUser(user);
  const initials = getInitials(user.nombreCompleto);

  return (
    <div className="app-shell">
      <header className="institutional-header app-header">
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
        <MobileMenu initials={initials} navigation={navigation} user={user} />
      </header>

      <div className="app-body">
        <aside className="sidebar desktop-sidebar">
          <SidebarNav navigation={navigation} />

          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="user-avatar" aria-hidden="true">
                {initials}
              </div>
              <div className="sidebar-user-data">
                <span className="user-name">{user.nombreCompleto}</span>
                {user.roles.length > 1 ? (
                  <ProfileSwitcher activeRole={user.activeRole} roles={user.roles} />
                ) : (
                  <div className="profile-pill role-chip">{getPrimaryRole(user)}</div>
                )}
              </div>
            </div>
            <form action="/api/logout" method="post" className="logout-form">
              <button type="submit">
                <LogOut aria-hidden="true" size={20} strokeWidth={2} />
                <span>Cerrar Sesión</span>
              </button>
            </form>
            <div className="security-note desktop-security-note">
              <ShieldCheck aria-hidden="true" size={20} strokeWidth={2} />
              <span>Acceso seguro y confidencial.</span>
            </div>
          </div>
        </aside>

        <div className="content-area">{children}</div>
      </div>
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
