import { redirect } from "next/navigation";
import { canAccessModule } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DefectoPuntualForm } from "./defecto-puntual-form";

export const dynamic = "force-dynamic";

type DefectoPuntualPageProps = {
  searchParams?: Promise<{
    ppu?: string;
    error?: string;
  }>;
};

export default async function DefectoPuntualPage({ searchParams }: DefectoPuntualPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessModule(user, "defecto-puntual")) redirect("/sin-acceso");

  const params = await searchParams;
  const ppu = params?.ppu?.trim().toUpperCase() ?? "";
  const error = params?.error;

  const bus = ppu
    ? await prisma.bus.findUnique({
        where: { ppu },
        include: {
          pautaAplicable: {
            where: { aplica: true },
            orderBy: { itemPautaId: "asc" },
            include: { pauta: true },
          },
        },
      })
    : null;

  const pautaItems =
    bus?.pautaAplicable.map(({ pauta }) => ({
      id: pauta.id,
      elemento: pauta.elemento,
      item: pauta.item,
      atributo: pauta.atributo,
      criterioEspecifico: pauta.criterioEspecifico,
      criticidad: pauta.criticidad,
    })) ?? [];

  return (
    <main className="module-shell defect-page">
      <section className="module-header defect-header">
        <h1>Registrar defectos puntuales</h1>
        <p className="lead">
          Busque un bus por su PPU y registre uno o más defectos detectados durante la inspección.
        </p>
      </section>

      <DefectoPuntualForm bus={bus} error={error} pautaItems={pautaItems} ppu={ppu} />
    </main>
  );
}
