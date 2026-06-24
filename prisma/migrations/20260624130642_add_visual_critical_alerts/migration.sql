-- CreateTable
CREATE TABLE "alertas_criticas_vistas" (
    "id" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "perfil" TEXT NOT NULL,
    "id_inspeccion" TEXT NOT NULL,
    "fecha_notificacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alertas_criticas_vistas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alertas_criticas_vistas_id_usuario_perfil_fecha_notificacio_idx" ON "alertas_criticas_vistas"("id_usuario", "perfil", "fecha_notificacion");

-- CreateIndex
CREATE UNIQUE INDEX "alertas_criticas_vistas_id_usuario_perfil_id_inspeccion_key" ON "alertas_criticas_vistas"("id_usuario", "perfil", "id_inspeccion");

-- AddForeignKey
ALTER TABLE "alertas_criticas_vistas" ADD CONSTRAINT "alertas_criticas_vistas_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_criticas_vistas" ADD CONSTRAINT "alertas_criticas_vistas_id_inspeccion_fkey" FOREIGN KEY ("id_inspeccion") REFERENCES "inspecciones"("id_inspeccion") ON DELETE CASCADE ON UPDATE CASCADE;
