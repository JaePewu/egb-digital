-- CreateTable
CREATE TABLE "logs_actividad" (
    "id" TEXT NOT NULL,
    "fecha_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_usuario" TEXT,
    "usuario_nombre" TEXT NOT NULL,
    "usuario_correo" TEXT NOT NULL,
    "perfil" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "detalle" TEXT,
    "ip" TEXT,
    "dispositivo" TEXT,

    CONSTRAINT "logs_actividad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "logs_actividad_fecha_hora_idx" ON "logs_actividad"("fecha_hora");

-- CreateIndex
CREATE INDEX "logs_actividad_id_usuario_idx" ON "logs_actividad"("id_usuario");

-- CreateIndex
CREATE INDEX "logs_actividad_perfil_idx" ON "logs_actividad"("perfil");

-- CreateIndex
CREATE INDEX "logs_actividad_accion_idx" ON "logs_actividad"("accion");

-- CreateIndex
CREATE INDEX "logs_actividad_modulo_idx" ON "logs_actividad"("modulo");

-- CreateIndex
CREATE INDEX "logs_actividad_resultado_idx" ON "logs_actividad"("resultado");

-- AddForeignKey
ALTER TABLE "logs_actividad" ADD CONSTRAINT "logs_actividad_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;
