-- CreateTable
CREATE TABLE "usuarios" (
    "id_usuario" TEXT NOT NULL,
    "nombre_completo" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "contrasena" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "rol_administrador" BOOLEAN NOT NULL DEFAULT false,
    "rol_inspector" BOOLEAN NOT NULL DEFAULT false,
    "rol_autoridad" BOOLEAN NOT NULL DEFAULT false,
    "rol_operador" BOOLEAN NOT NULL DEFAULT false,
    "inspector_defecto_puntual" BOOLEAN NOT NULL DEFAULT false,
    "inspector_revision_pauta" BOOLEAN NOT NULL DEFAULT false,
    "operador_puede_resolver" BOOLEAN NOT NULL DEFAULT false,
    "observaciones" TEXT,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "operadores" (
    "id_operador" TEXT NOT NULL,
    "nombre_operador" TEXT NOT NULL,
    "rut_operador" TEXT,
    "estado" TEXT NOT NULL,

    CONSTRAINT "operadores_pkey" PRIMARY KEY ("id_operador")
);

-- CreateTable
CREATE TABLE "usuario_operador" (
    "id_usuario" TEXT NOT NULL,
    "id_operador" TEXT NOT NULL,

    CONSTRAINT "usuario_operador_pkey" PRIMARY KEY ("id_usuario","id_operador")
);

-- CreateTable
CREATE TABLE "buses" (
    "ppu" TEXT NOT NULL,
    "id_operador" TEXT NOT NULL,
    "operador" TEXT NOT NULL,
    "rut_operador" TEXT,
    "chasis_marca" TEXT,
    "chasis_modelo" TEXT,
    "carroceria_marca" TEXT,
    "carroceria_modelo" TEXT,
    "tecnologia" TEXT,
    "tipo_bus" TEXT,
    "anio" INTEGER,
    "fecha_inicio_operacion" TIMESTAMP(3),
    "estado_bus" TEXT NOT NULL,
    "certificador" TEXT,
    "correo_operador_simulado" TEXT,
    "correo_certificador_simulado" TEXT,
    "correo_autoridad_simulado" TEXT,

    CONSTRAINT "buses_pkey" PRIMARY KEY ("ppu")
);

-- CreateTable
CREATE TABLE "pauta_inspeccion" (
    "id_item_pauta" TEXT NOT NULL,
    "id_original" TEXT,
    "elemento" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "atributo" TEXT NOT NULL,
    "criterio_especifico" TEXT NOT NULL,
    "criticidad" TEXT NOT NULL,
    "cobertura_interaccion" TEXT,

    CONSTRAINT "pauta_inspeccion_pkey" PRIMARY KEY ("id_item_pauta")
);

-- CreateTable
CREATE TABLE "pauta_por_bus" (
    "ppu" TEXT NOT NULL,
    "id_item_pauta" TEXT NOT NULL,
    "aplica" BOOLEAN NOT NULL,

    CONSTRAINT "pauta_por_bus_pkey" PRIMARY KEY ("ppu","id_item_pauta")
);

-- CreateTable
CREATE TABLE "inspecciones" (
    "id_inspeccion" TEXT NOT NULL,
    "fecha" TEXT NOT NULL,
    "hora" TEXT NOT NULL,
    "fecha_hora" TIMESTAMP(3) NOT NULL,
    "ppu" TEXT NOT NULL,
    "operador" TEXT NOT NULL,
    "chasis" TEXT,
    "carroceria" TEXT,
    "tecnologia" TEXT,
    "tipo_bus" TEXT,
    "anio" INTEGER,
    "tipo_inspeccion" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "id_inspector" TEXT NOT NULL,
    "inspector_nombre" TEXT,
    "inspector_correo" TEXT,
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "ubicacion_simulada" TEXT,
    "criticidad_mas_grave" TEXT NOT NULL,
    "cantidad_defectos" INTEGER NOT NULL,
    "efecto_inspeccion" TEXT,
    "fecha_limite_reparacion" TIMESTAMP(3),
    "ultima_actualizacion" TIMESTAMP(3),
    "id_operador_resolutor" TEXT,
    "operador_resolutor_nombre" TEXT,
    "todos_defectos_reparados" BOOLEAN NOT NULL DEFAULT false,
    "observacion_general_inspector" TEXT,
    "observacion_general_operador" TEXT,

    CONSTRAINT "inspecciones_pkey" PRIMARY KEY ("id_inspeccion")
);

-- CreateTable
CREATE TABLE "defectos_detectados" (
    "id_detalle" TEXT NOT NULL,
    "id_inspeccion" TEXT NOT NULL,
    "ppu" TEXT NOT NULL,
    "id_item_pauta" TEXT NOT NULL,
    "elemento" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "atributo" TEXT NOT NULL,
    "criterio_especifico" TEXT NOT NULL,
    "criticidad" TEXT NOT NULL,
    "observacion_inspector" TEXT,
    "cantidad_adjuntos_inspector" INTEGER NOT NULL DEFAULT 0,
    "url_foto_inspector" TEXT,
    "url_video_inspector" TEXT,
    "defecto_reparado" BOOLEAN NOT NULL DEFAULT false,
    "observacion_operador" TEXT,
    "fecha_marcado_reparado" TIMESTAMP(3),
    "estado_defecto" TEXT NOT NULL,

    CONSTRAINT "defectos_detectados_pkey" PRIMARY KEY ("id_detalle")
);

-- CreateTable
CREATE TABLE "resultados_pauta" (
    "id" SERIAL NOT NULL,
    "id_inspeccion" TEXT NOT NULL,
    "ppu" TEXT NOT NULL,
    "id_item_pauta" TEXT NOT NULL,
    "elemento" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "atributo" TEXT NOT NULL,
    "criterio_especifico" TEXT NOT NULL,
    "criticidad" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "observacion" TEXT,
    "url_evidencia" TEXT,

    CONSTRAINT "resultados_pauta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id_notificacion" TEXT NOT NULL,
    "fecha_hora" TIMESTAMP(3) NOT NULL,
    "tipo_notificacion" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "tipo_inspeccion" TEXT NOT NULL,
    "ppu" TEXT NOT NULL,
    "id_inspeccion" TEXT NOT NULL,
    "operador" TEXT NOT NULL,
    "responsable" TEXT,
    "certificador" TEXT,
    "correo_operador_simulado" TEXT,
    "correo_certificador_simulado" TEXT,
    "correo_autoridad_simulado" TEXT,
    "asunto_correo_simulado" TEXT,
    "cuerpo_correo_simulado" TEXT,
    "estado" TEXT NOT NULL,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id_notificacion")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_key" ON "usuarios"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "resultados_pauta_id_inspeccion_id_item_pauta_key" ON "resultados_pauta"("id_inspeccion", "id_item_pauta");

-- AddForeignKey
ALTER TABLE "usuario_operador" ADD CONSTRAINT "usuario_operador_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_operador" ADD CONSTRAINT "usuario_operador_id_operador_fkey" FOREIGN KEY ("id_operador") REFERENCES "operadores"("id_operador") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buses" ADD CONSTRAINT "buses_id_operador_fkey" FOREIGN KEY ("id_operador") REFERENCES "operadores"("id_operador") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pauta_por_bus" ADD CONSTRAINT "pauta_por_bus_ppu_fkey" FOREIGN KEY ("ppu") REFERENCES "buses"("ppu") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pauta_por_bus" ADD CONSTRAINT "pauta_por_bus_id_item_pauta_fkey" FOREIGN KEY ("id_item_pauta") REFERENCES "pauta_inspeccion"("id_item_pauta") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspecciones" ADD CONSTRAINT "inspecciones_ppu_fkey" FOREIGN KEY ("ppu") REFERENCES "buses"("ppu") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspecciones" ADD CONSTRAINT "inspecciones_id_inspector_fkey" FOREIGN KEY ("id_inspector") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspecciones" ADD CONSTRAINT "inspecciones_id_operador_resolutor_fkey" FOREIGN KEY ("id_operador_resolutor") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defectos_detectados" ADD CONSTRAINT "defectos_detectados_id_inspeccion_fkey" FOREIGN KEY ("id_inspeccion") REFERENCES "inspecciones"("id_inspeccion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defectos_detectados" ADD CONSTRAINT "defectos_detectados_ppu_fkey" FOREIGN KEY ("ppu") REFERENCES "buses"("ppu") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defectos_detectados" ADD CONSTRAINT "defectos_detectados_id_item_pauta_fkey" FOREIGN KEY ("id_item_pauta") REFERENCES "pauta_inspeccion"("id_item_pauta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_pauta" ADD CONSTRAINT "resultados_pauta_id_inspeccion_fkey" FOREIGN KEY ("id_inspeccion") REFERENCES "inspecciones"("id_inspeccion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_pauta" ADD CONSTRAINT "resultados_pauta_ppu_fkey" FOREIGN KEY ("ppu") REFERENCES "buses"("ppu") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_pauta" ADD CONSTRAINT "resultados_pauta_id_item_pauta_fkey" FOREIGN KEY ("id_item_pauta") REFERENCES "pauta_inspeccion"("id_item_pauta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_ppu_fkey" FOREIGN KEY ("ppu") REFERENCES "buses"("ppu") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_id_inspeccion_fkey" FOREIGN KEY ("id_inspeccion") REFERENCES "inspecciones"("id_inspeccion") ON DELETE CASCADE ON UPDATE CASCADE;
