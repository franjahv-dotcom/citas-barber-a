# Mala Vida Barbers

Sistema web de citas basado en los requisitos de la primera entrega. React y Tailwind en la interfaz; Express y MySQL en el servidor.

## Iniciar el proyecto

Requiere Node.js 22.12 o posterior y Docker Desktop en ejecución. Desde la carpeta principal:

```powershell
npm run setup
npm run db
npm run build
npm start
```

Abrir **http://127.0.0.1:3001**. El servidor entrega la interfaz y la API desde la misma dirección. La primera ejecución prepara las tablas, migra la estructura anterior sin borrar citas y crea un administrador.

Las credenciales iniciales están en **backend/.admin-access.txt**. Ese archivo está excluido de Git. Entra en Administración → Mi cuenta para cambiar la contraseña. No hay contraseña predeterminada compartida. Una contraseña configurada mediante ADMIN_PASSWORD solo se usa al crear el primer administrador.

Para desarrollo con recarga de la interfaz, después de levantar MySQL:

```powershell
npm run dev
```

Abrir http://127.0.0.1:5173. No ejecutar `npm start` y `npm run dev` simultáneamente: ambos intentan iniciar el servidor de la API.

## Funciones

- Catálogo con precios, descripción y duración; servicios asignados a cada barbero.
- Disponibilidad calculada con jornadas, descansos, bloqueos y citas activas.
- Reservas con teléfono obligatorio, fechas válidas y validación definitiva en el servidor.
- Protección de concurrencia mediante una fila de bloqueo en MySQL dentro de la transacción. Las escrituras de agenda, jornadas y catálogos comparten ese bloqueo.
- Acceso administrativo con contraseñas derivadas con scrypt y sesiones HttpOnly/SameSite.
- Agenda por fecha, barbero, estado, nombre o teléfono y paginación.
- Reprogramación atómica, cancelación con historial, atención completada y ausencia.
- Gestión de servicios, barberos, periodos semanales y bloqueos. Las citas afectadas por cambios se señalan, nunca se eliminan automáticamente.
- Clientes e historial: el teléfono no es único. Se reutilizan coincidencias de nombre y teléfono; distintas personas con un teléfono compartido conservan registros separados.
- Registro de movimientos de las citas, incluyendo cambios de horario y de estado.
- Interfaz adaptable, formularios etiquetados, avisos de error y cuadros de confirmación.

## Reglas del prototipo

Los horarios usan **America/Mexico_City**, sin convertir las fechas civiles según la zona del navegador. La jornada inicial de los barberos existentes es lunes a sábado, 10:00–14:00 y 15:00–20:00. Se puede editar por trabajador y día. Los barberos nuevos requieren configurar su jornada. Los servicios nuevos requieren asignarlos a un barbero.

Reservas con hasta 90 días de anticipación, intervalos sugeridos cada 10 minutos y duración completa dentro de la jornada. No hay margen adicional entre servicios. Las reservas públicas se confirman directamente. Solo el administrador cancela o reprograma. Las citas completadas, canceladas y ausencias son estados finales. Completar exige haber llegado a la hora de fin; registrar ausencia exige haber llegado a la hora de inicio. Los bloques pueden abarcar varios días.

Cambiar la duración de un servicio no cambia los intervalos reservados. Una reprogramación vuelve a calcular el intervalo según el servicio elegido y valida su disponibilidad. La baja de un servicio o trabajador conserva las citas históricas.

Son supuestos configurados del caso académico, no políticas validadas mediante entrevistas. No incluye pagos, inventario, nómina, recordatorios automáticos ni cuentas individuales de barberos.

## Pruebas

```powershell
npm test
```

Usa MySQL real: crea una base temporal con nombre aleatorio `barberia_test_*`, prueba las reglas y la API y elimina únicamente esa base al terminar. No borra ni modifica la base de la aplicación. La cuenta de prueba necesita permiso para crear y eliminar su base temporal.

Para los recorridos en navegador, primero compila la interfaz. Puedes usar Chrome instalado:

```powershell
$env:BROWSER_CHANNEL = 'chrome'
npm run build
npm run test:browser
```

También se puede usar `msedge`, o instalar Chromium de Playwright con `npx --prefix backend playwright install chromium` y no definir BROWSER_CHANNEL. Las capturas de prueba se guardan en `backend/test-results/`, excluido de Git.

`npm run check` ejecuta análisis del frontend, compilación y pruebas del servidor. Los casos incluyen concurrencia de 20 reservas, cruces parciales, límites adyacentes, reprogramación rechazada, bloqueos, permisos, estados, búsqueda, configuración y conservación de historial.

## Configuración y estructura

`backend/.env.example` contiene la configuración opcional. La configuración local de Docker solo publica MySQL en esta computadora. Si se despliega en otro entorno, usar credenciales propias, HTTPS y COOKIE_SECURE=true.

- `backend/src/domain.js`: fechas civiles y validaciones.
- `backend/src/db.js`: acceso a datos y transacciones.
- `backend/src/scheduling.js`: disponibilidad y reglas de agenda.
- `backend/src/auth.js`: contraseñas, sesiones y límite de intentos.
- `backend/src/public-routes.js` y `admin-routes.js`: operaciones de la aplicación.
- `backend/src/init.js`: preparación y migración conservadora de datos.
- `database/schema.sql`: tablas e índices.
- `frontend/src/components/`: reserva, agenda, catálogos, jornadas, bloqueos y clientes.

El volumen `db_data` conserva MySQL entre reinicios. Para detener la base sin borrar datos usa `docker compose stop`. No elimines ese volumen si quieres conservar citas y usuarios.
