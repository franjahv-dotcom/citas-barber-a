# Explicación Completa del Proyecto: Mala Vida Barbers

Este documento explica de forma sencilla y detallada cómo funciona todo el código de la barbería. El proyecto está dividido en tres grandes bloques que se comunican entre sí: **Base de Datos**, **Backend (Servidor)** y **Frontend (Interfaz)**.

---

## 1. La Base de Datos (MySQL)
**Ubicación:** Docker y \`database/schema.sql\`

La base de datos es el "cerebro" donde guardamos la información para que no se pierda al apagar la computadora. Usamos MySQL y tenemos tres tablas principales:
- **\`barbers\`**: Guarda los nombres de los barberos (ej. Marco, Luis) y si están activos.
- **\`services\`**: Guarda los servicios que ofrecen, su precio y lo más importante: **su duración en minutos** (ej. Corte Clásico dura 40 minutos).
- **\`appointments\`**: Es la tabla de citas. Cada vez que alguien reserva, guardamos quién fue (nombre y teléfono), qué barbero eligió, qué servicio, a qué hora empieza (\`start_time\`) y a qué hora termina (\`end_time\`). 

*(Nota: Usar Docker nos permite levantar esta base de datos automáticamente sin tener que instalar MySQL manualmente en la computadora).*

---

## 2. El Backend (Node.js + Express)
**Ubicación:** Carpeta \`backend/\` (\`server.js\`)

El backend es como el "recepcionista" de la barbería. La base de datos es la caja fuerte y el cliente no tiene la llave. Si el cliente quiere algo, tiene que pedírselo al backend.

En el archivo \`server.js\` creamos una API (Application Programming Interface). Esta API tiene las siguientes rutas (endpoints):
- **\`GET /api/barbers\` y \`GET /api/services\`**: Cuando la página web se carga, le pregunta al backend "¿qué barberos y servicios hay?". El backend va a MySQL, saca la lista y se la devuelve a la página.
- **\`GET /api/appointments\`**: Sirve para el Panel de Administrador. Devuelve la lista de las citas programadas. Se puede filtrar por fecha.

**La lógica de seguridad (El corazón del sistema):**
- **\`POST /api/appointments\`**: Cuando el cliente da clic en "Confirmar Reserva", los datos llegan aquí. El backend no guarda la cita a ciegas. Primero hace lo siguiente:
  1. **Calcula el tiempo:** Busca en la base de datos cuánto dura el servicio elegido y calcula matemáticamente a qué hora termina la cita.
  2. **Valida cruces (Traslapes):** Hace una consulta en la base de datos preguntando si *ese mismo barbero* ya tiene una cita que se cruce en ese rango de tiempo (hora de inicio nueva menor a hora de fin existente, y hora de fin nueva mayor a hora de inicio existente).
  3. **Guarda o Rechaza:** Si hay un cruce, rechaza la cita enviando un error \`409 Conflict\`. Si el horario está libre, inserta la cita en MySQL.

---

## 3. El Frontend (React + Tailwind CSS)
**Ubicación:** Carpeta \`frontend/\`

El frontend es la "fachada" del negocio, lo que el cliente ve y toca en su navegador. Está construido con React (para hacerlo rápido y dinámico) y Vite (para compilarlo). 

- **\`App.jsx\`**: Es el archivo principal. Tiene un menú de navegación arriba ("Reservar" y "Panel Admin") y controla qué pantalla estás viendo actualmente.
- **\`BookingForm.jsx\`**: Es el formulario del cliente. 
  - Al cargar, pide al backend la lista de barberos y servicios y los pone en los selectores desplegables.
  - Cuando el cliente llena el formulario (nombre, teléfono, fecha, hora) y da clic en enviar, este archivo empaqueta esa información y se la manda al backend. 
  - Si el backend rechaza la cita (por ejemplo, porque la hora ya estaba tomada), muestra un mensaje de error en rojo. Si se acepta, muestra un éxito en verde.
- **\`AdminPanel.jsx\`**: Es la pantalla del dueño de la barbería. Muestra una tabla con todas las citas. Tiene un calendario arriba; si seleccionas una fecha, vuelve a preguntarle al backend "dame las citas solo de este día" y actualiza la tabla en tiempo real.

**Diseño (Tailwind CSS):**
Usamos Tailwind para pintar la página sin tener que escribir hojas de estilo CSS kilométricas. En \`index.css\` definimos nuestras variables personalizadas "Negro Mate" (\`--color-mate\`) y "Dorado" (\`--color-gold\`), y usamos clases de Tailwind (como \`bg-mate_light\` o \`text-gold\`) directamente en el código de React para darle el estilo elegante de barbería.

---

## El Recorrido Completo (Ejemplo práctico)
1. **Cliente entra a la web:** El Frontend (\`BookingForm.jsx\`) le pide los servicios al Backend (\`server.js\`), que los lee de MySQL y los devuelve. El cliente ve las opciones.
2. **Cliente elige:** Selecciona "Corte y Barba" con "Marco" a las 15:00 hrs. Da clic en "Confirmar".
3. **Petición al Backend:** El Frontend manda los datos a \`POST /api/appointments\`.
4. **Backend calcula:** "Corte y Barba" dura 60 minutos. La cita es de 15:00 a 16:00.
5. **Backend verifica:** Revisa en MySQL si Marco tiene algo entre las 15:00 y las 16:00. No tiene nada.
6. **Backend guarda:** Inserta la cita en MySQL y le responde al Frontend "¡Todo bien!".
7. **Frontend muestra éxito:** El cliente ve el mensaje verde. 
8. **Dueño revisa:** El administrador entra al Panel, el Frontend pide las citas al Backend y el dueño ve que Marco tiene un cliente a las 15:00.
