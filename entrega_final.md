**Sistema web de gestión y control de citas para una barbería: Fase Práctica y Prototipo**
**Materia:** Ingeniería de Software
**Nombre de alumno:** Emmanuel Perea
**Fecha:** 23 de septiembre de 2026

---

### Índice

1. Introducción
2. Diseño de Software
   4.1 Arquitectura del sistema
   4.2 Modelo de base de datos
   4.3 Diseño de la interfaz y experiencia de usuario
   4.4 Decisiones tecnológicas
3. Desarrollo de Software
   5.1 Configuración del entorno y servidor
   5.2 Construcción del frontend
   5.3 Lógica de negocio y problemas técnicos
4. Pruebas de Software
   6.1 Planificación de pruebas
   6.2 Pruebas unitarias
   6.3 Pruebas de integración
   6.4 Resolución de fallos críticos
   6.5 Pruebas de usabilidad
5. Calidad de Software
   7.1 Rendimiento y optimización
   7.2 Adaptabilidad (Responsive Design)
   7.3 Seguridad básica
   7.4 Mantenibilidad del código
6. Conclusiones
7. Referencias

---

### 1. Introducción

En la primera etapa de este proyecto todo se veía muy claro en papel. Tenía mis diagramas de casos de uso, las historias de usuario bien redactadas y un diseño lógico que, en teoría, iba a solucionar el caos de las reservas en Mala Vida Barbers. La idea central siempre fue la misma: evitar que dos clientes llegaran a la misma hora para cortarse el pelo con el mismo barbero y que el encargado tuviera que pedirle a uno que esperara en el sillón.

Pero una cosa es decir "el sistema validará la disponibilidad" en un documento de Word, y otra muy distinta es sentarse frente al monitor, abrir el editor de código y hacer que React, Node.js y MySQL se entiendan sin que la aplicación colapse. 

En esta fase final presento el resultado práctico de semanas de programación. Ya no son diagramas. Construí un prototipo funcional. Me tocó traducir todas esas reglas de negocio a funciones, endpoints y consultas SQL reales. Durante el proceso me di cuenta de que muchas cosas que di por sentadas en la planificación eran mucho más complejas de programar. Me topé con bloqueos técnicos que no vi venir, tuve que reescribir partes del código desde cero y aprendí a la mala que los navegadores son muy estrictos con la seguridad.

Este informe documenta exactamente cómo construí el sistema. Explicaré cómo estructuré la base de datos para que las citas no se perdieran, cómo armé la interfaz para que funcionara bien en los celulares de los clientes y, sobre todo, cómo resolví los errores que fueron saliendo en el camino. No fue un proceso lineal. Hubo días donde parecía que nada funcionaba, pero el resultado es una aplicación que cumple con lo que prometí en el análisis inicial: una agenda centralizada, rápida y que no permite empalmar horarios.

---

### 4. Diseño de Software

#### 4.1 Arquitectura del sistema
Desde el principio supe que no quería hacer un sistema monolítico tradicional donde el servidor escupe HTML. Decidí separar el proyecto usando una arquitectura Cliente-Servidor (Frontend y Backend separados). 

Diseñé el cliente usando React porque necesito que la interfaz responda al instante cuando el usuario cambie de fecha en el calendario. Si el cliente tiene que recargar toda la página cada vez que elige a un barbero distinto, se va a desesperar. Del lado del servidor dejé Node.js con Express funcionando como una API REST. Esta API es la única autorizada para hablar con MySQL. Me pareció la forma más segura de hacerlo; si alguien intenta inspeccionar el código de React en su navegador, jamás verá las contraseñas de la base de datos.

#### 4.2 Modelo de base de datos
Diseñar las tablas en SQL fue más confuso de lo que esperaba. Al inicio pensé en hacer una sola tabla gigante con todas las citas, pero rápido me di cuenta de que iba a ser un desastre si un barbero renunciaba o cambiaban los precios.

Al final dejé tres tablas principales conectadas. La tabla `barbers` solo tiene el nombre y un estado activo. La tabla `services` tiene el nombre del corte, el precio y, la columna que me salvó la vida: `duration_minutes`. No puedes calcular si una cita choca con otra si no sabes cuánto dura el corte. 

La tabla fuerte es `appointments`. Aquí conecté todo con llaves foráneas (`barber_id` y `service_id`). Registré la hora de inicio y de fin usando formato `DATETIME`. Tomé la decisión de calcular la hora de fin desde el backend antes de guardar; preferí hacerlo así porque si en el futuro alguien cambia la duración del servicio en la base de datos, las citas pasadas no se verán afectadas mágicamente.

#### 4.3 Diseño de la interfaz y experiencia de usuario
Fui muy pragmático aquí. Usé el enfoque "Mobile First" (pensar en celulares primero). Seamos honestos, el 99% de los clientes de una barbería van a agendar desde su teléfono mientras van en el camión o están en su cuarto. Si los botones son muy pequeños o el formulario te obliga a hacer scroll de lado, no lo van a usar.

Para lograrlo utilicé Tailwind CSS. Elegí una paleta de colores oscuro (Negro Mate) con acentos dorados. Da una vibra elegante y moderna, que es exactamente la estética de Mala Vida Barbers. Los formularios los hice de una sola columna fluida. Si lo abres en computadora se expande hasta un límite, pero en celular ocupa el ancho exacto de la pantalla. No metí imágenes pesadas ni animaciones innecesarias, la prioridad era que cargara rápido.

#### 4.4 Decisiones tecnológicas
Elegir la tecnología fue un volado entre lo que quería aprender y lo que necesitaba entregar a tiempo. 
- **Frontend:** Me fui por React usando Vite. Vite es ridículamente más rápido que el viejo `create-react-app` que nos enseñaron en semestres pasados.
- **Backend:** Node.js con Express porque ya conozco JavaScript. Podía haber usado Python o Java, pero no quería pelear con la sintaxis de otro lenguaje mientras intentaba resolver la lógica de las fechas.
- **Base de datos:** MySQL. Todo el mundo la usa, hay miles de foros si te atoras (y vaya que me atoré) y es sólida para manejar relaciones. Usé el paquete `mysql2/promise` para no ahogarme en el viejo "callback hell" de Node.
