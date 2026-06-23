# EGB Digital MVP

MVP web de EGB Digital con Next.js, Prisma, PostgreSQL en Neon y carga inicial desde los Excel entregados.

## Stack elegido

- Next.js + React + TypeScript para mantener web y lectura de datos en un solo proyecto.
- Prisma como capa simple de acceso a datos.
- PostgreSQL administrado por Neon.
- Seed Node leyendo directamente los Excel ubicados en `data/raw`.

## Variables de entorno

El proyecto necesita:

```bash
DATABASE_URL="conexion PostgreSQL agrupada de Neon"
DATABASE_URL_UNPOOLED="conexion PostgreSQL directa de Neon"
SESSION_SECRET="secreto largo y privado"
```

La integracion Neon de Vercel crea las dos variables de base de datos automaticamente.

## Instalacion local

```bash
npm install
npm run db:setup
```

Para recrear la base desde cero:

```bash
npm run db:reset
```

## Correr localmente

```bash
npm run dev
```

Abrir: http://localhost:3000

## Login local

- Ruta de ingreso: http://localhost:3000/login
- Sesion local MVP con cookie HTTP-only firmada.
- Usuarios inactivos quedan bloqueados.
- La navegacion se arma segun el perfil activo y permisos guardados en PostgreSQL.
- Si un usuario tiene mas de un perfil, puede cambiar perfil activo sin cerrar sesion.

## Despliegue en Vercel

Vercel usa automaticamente `npm run vercel-build`. Ese comando:

1. Sincroniza el esquema Prisma con Neon.
2. Carga los Excel solo cuando la tabla de usuarios esta vacia.
3. Compila la aplicacion.

Los despliegues posteriores no vuelven a ejecutar el seed si la base ya contiene usuarios.

## Datos semilla

La carga inicial usa estos archivos:

- `data/raw/01_usuarios_permisos_mvp.xlsx`
- `data/raw/02_buses_pauta_aplicable_mvp.xlsx`
- `data/raw/03_pauta_regb_mvp.xlsx`
- `data/raw/04_inspecciones_defectos_mvp.xlsx`
- `data/raw/05_notificaciones_mvp.xlsx`

Tablas principales creadas:

- `usuarios`
- `operadores`
- `usuario_operador`
- `buses`
- `pauta_inspeccion`
- `pauta_por_bus`
- `inspecciones`
- `defectos_detectados`
- `resultados_pauta`
- `notificaciones`

## Usuarios de prueba

Todos los usuarios semilla usan la contraseña `pass123`.

| Usuario | Correo | Roles |
| --- | --- | --- |
| Ana Martinez | `ana.martinez@dtpm.cl` | Administrador |
| Juan Rojas | `juan.rojas@dtpm.cl` | Inspector |
| Maria Gonzalez | `maria.gonzalez@stp.cl` | Operador |
| Carolina Perez | `carolina.perez@dtpm.cl` | Autoridad |
| Felipe Munoz | `felipe.munoz@subuschile.cl` | Operador inactivo |
| Sofia Torres | `sofia.torres@dtpm.cl` | Administrador, Autoridad, Operador, Inspector |

Nota MVP: `operador_puede_resolver` se mantiene como permiso unico del usuario. En una version definitiva podria pasar a `usuario_operador` para definir resolucion por operador asignado.

## Alcance actual

Incluye base tecnica, modelo PostgreSQL, seed reproducible, autenticacion y pantallas del MVP.

No incluye envio real de correos ni almacenamiento definitivo de archivos adjuntos.
