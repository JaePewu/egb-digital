# Reglas para Codex - EGB Digital MVP

## Idioma y estilo

- Responder en espanol.
- Ser ejecutivo y breve: decisiones, avances, bloqueos y verificacion.
- Preguntar maximo 3 cosas solo si no se puede decidir razonablemente.

## Decisiones tecnicas vigentes

- Mantener simpleza por sobre arquitectura compleja.
- Usar Next.js + TypeScript + Prisma + SQLite local.
- No usar PostgreSQL, Docker ni configuracion de produccion en esta etapa.
- No enviar correos reales: registrar notificaciones y correos simulados.
- No subir archivos reales: usar URLs ficticias de evidencia.
- Coordenadas simuladas.
- Roles oficiales: Administrador, Inspector, Autoridad y Operador.
- Usuarios semilla: contrasena `pass123`.

## Datos

- Los Excel fuente viven en `data/raw`.
- El seed debe leer los Excel directamente mediante `scripts/seed.js`.
- Mantener nombres de tablas coherentes con el informe y los Excel.
- Si se cambia el modelo, actualizar `prisma/schema.prisma`, `scripts/seed.js` y `README.md`.
- MVP actual: `operador_puede_resolver` es permiso unico del usuario. En version definitiva podria moverse a `usuario_operador` para resolver por operador asignado.

## Verificacion esperada

- `npm install`
- `npm run db:push`
- `npm run db:seed`
- `npm run build`
- `npm run dev` para validar la pantalla local cuando corresponda.

## Fuera de alcance por defecto

- Login completo.
- Pantallas finales o mockups.
- PostgreSQL.
- Docker.
- Produccion.
- Envio real de correos.
- Subida real de archivos.
