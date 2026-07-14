ALTER TABLE "notificaciones"
ADD COLUMN "correo_simulado_enviado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "fecha_correo_simulado" TIMESTAMP(3);
