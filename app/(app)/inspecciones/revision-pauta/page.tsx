import { redirect } from "next/navigation";
import { canAccessModule } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RevisionPautaForm } from "./revision-pauta-form";

export const dynamic = "force-dynamic";

type RevisionPautaPageProps = {
  searchParams?: Promise<{
    ppu?: string;
    error?: string;
  }>;
};

export default async function RevisionPautaPage({ searchParams }: RevisionPautaPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessModule(user, "revision-pauta")) redirect("/sin-acceso");

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
        <h1>Revisión de pauta</h1>
      </section>

      <RevisionPautaForm bus={bus} error={error} pautaItems={pautaItems} ppu={ppu} />
    </main>
  );
}
