# EGB Digital MVP

Base tecnica local para validar el MVP de EGB Digital: app web local, SQLite, Prisma y carga inicial desde los Excel entregados.

## Stack elegido

- Next.js + React + TypeScript para mantener web y lectura de datos en un solo proyecto.
- Prisma como capa simple de acceso a datos.
- SQLite local en `prisma/dev.db`.
- Seed Node leyendo directamente los Excel ubicados en `data/raw`.

## Instalacion

```bash
npm install
npm run db:push
npm run db:seed
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
- La navegacion se arma segun roles y permisos guardados en SQLite.

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
| Ana Martinez | `ana.martinez@egb.local` | Administrador |
| Juan Rojas | `juan.rojas@egb.local` | Inspector |
| Camila Perez | `camila.perez@egb.local` | Inspector |
| Maria Gonzalez | `maria.gonzalez@egb.local` | Operador |
| Carolina Perez | `carolina.perez@egb.local` | Autoridad |
| Diego Fuentes | `diego.fuentes@egb.local` | Operador |
| Felipe Munoz | `felipe.munoz@egb.local` | Operador inactivo |

## Alcance actual

Incluye base tecnica, modelo local, seed reproducible y una pantalla inicial que confirma lectura desde SQLite.

No incluye login completo, pantallas finales, carga real de archivos, envio real de correos, Docker ni PostgreSQL.
