"use server";

import { redirect } from "next/navigation";
import { canAccessModule } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function saveUserAdministration(formData: FormData) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (!canAccessModule(currentUser, "administracion")) redirect("/sin-acceso");

  const usuarioId = String(formData.get("usuarioId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/administracion");
  if (!usuarioId) redirect("/administracion");

  const operadores = formData
    .getAll("operadores")
    .map((value) => String(value))
    .filter(Boolean);

  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: usuarioId },
      data: {
        estado: String(formData.get("estado") ?? "Activo"),
        rolAdministrador: formData.get("rolAdministrador") === "on",
        rolInspector: formData.get("rolInspector") === "on",
        rolAutoridad: formData.get("rolAutoridad") === "on",
        rolOperador: formData.get("rolOperador") === "on",
        inspectorDefectoPuntual: formData.get("inspectorDefectoPuntual") === "on",
        inspectorRevisionPauta: formData.get("inspectorRevisionPauta") === "on",
        operadorPuedeResolver: formData.get("operadorPuedeResolver") === "on",
      },
    });

    await tx.usuarioOperador.deleteMany({ where: { usuarioId } });
    for (const operadorId of operadores) {
      await tx.usuarioOperador.create({
        data: {
          usuarioId,
          operadorId,
        },
      });
    }
  });

  redirect(returnTo);
}
