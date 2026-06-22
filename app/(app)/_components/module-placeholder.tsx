import { redirect } from "next/navigation";
import type { ModuleKey } from "@/lib/access";
import { canAccessModule, navigationItems } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";

type ModulePlaceholderProps = {
  moduleKey: ModuleKey;
  title?: string;
  children?: React.ReactNode;
};

export async function ModulePlaceholder({ moduleKey, title, children }: ModulePlaceholderProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessModule(user, moduleKey)) redirect("/sin-acceso");

  const item = navigationItems.find((navItem) => navItem.key === moduleKey);

  return (
    <main className="module-shell">
      <section className="module-header">
        <h1>{title ?? item?.label}</h1>
        <p className="lead">{item?.description}</p>
      </section>
      <section className="placeholder-panel">
        <h2>Funcionalidad pendiente</h2>
        <p>
          La navegación y protección de ruta ya están activas. La pantalla completa se implementará
          en los siguientes pasos del MVP.
        </p>
        {children}
      </section>
    </main>
  );
}
