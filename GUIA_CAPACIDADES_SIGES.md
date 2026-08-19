# Guía de capacidades de SIGES

SIGES es el **Sistema Integral de Gestión Estratégica** de Heliot Media. Centraliza la operación comercial, la coordinación del equipo, los procesos de Recursos Humanos, la seguridad y la comunicación interna en una sola plataforma.

> La disponibilidad en vivo de cada módulo depende de que las reglas actuales de Firestore estén publicadas. Las funciones de adjuntos privados permanecen condicionadas a la activación de Firebase Storage, que en este proyecto solicita facturación.

## Perfiles de acceso

| Perfil | Alcance principal |
|---|---|
| **Departamento de IT** | Control total de identidad, seguridad, Personal, historial, automatizaciones y configuración global. |
| **Administrador** | Operación comercial, Recursos Humanos, finanzas, tareas, notificaciones, pendientes y automatizaciones operativas. |
| **Personal** | Consulta y gestión de su trabajo, clientes, reservas, pagos permitidos, expediente personal, asistencia, solicitudes y comunicaciones internas. |

## Resumen y navegación

El inicio reúne la agenda del día, los cobros confirmados, el volumen de clientes, reservas pendientes y avisos internos. La barra lateral se puede contraer y la navegación conserva el historial del navegador, por lo que Atrás y Adelante permanecen dentro de SIGES. En móvil se muestran accesos rápidos y una barra de pestañas.

La búsqueda global se abre con `Ctrl/Cmd + K`. Desde ella se pueden localizar registros operativos de clientes, reservas, pagos, tareas, incidencias y finanzas según el rol.

## Operación comercial

| Módulo | Qué permite hacer |
|---|---|
| **Calendario** | Consultar reservas por mes, identificar agenda diaria y abrir una reserva al tocarla. |
| **Clientes** | Crear, editar, ordenar por nombres o apellidos, buscar, revisar ficha y aplicar acciones masivas cuando se activa el modo de edición. Los códigos usan el formato `CLI-00001`. |
| **Reservas** | Crear reservas individuales o grupales, elegir producto, vincular cliente, definir fecha, hora, duración, participantes y responsable. Los códigos usan `RES-00001`. |
| **Pagos** | Registrar anticipos, pagos parciales, saldos o pagos completos; vincularlos a clientes y reservas; marcar estados y descargar comprobantes PDF. Los códigos usan `PAG-00001`. |
| **Productos** | Consultar aranceles y promociones. Administración e IT pueden crear, editar o retirar paquetes y precios. |
| **Tareas e incidencias** | Crear trabajo vinculado a reservas, asignar responsables, fechas límite, prioridades y estados; reportar incidencias y documentar su resolución. Los códigos usan `TAR-00001` e `INC-00001`. |

Las filas de clientes, reservas, pagos, tareas, incidencias, historial y muchas tarjetas son táctiles: al pulsarlas se abre su ficha. Los iconos pequeños permanecen como accesos rápidos, no como requisito para revisar la información.

## Recursos Humanos

Recursos Humanos concentra el expediente de cada integrante, organización, vida laboral, desarrollo y control.

| Área | Capacidades |
|---|---|
| **Mi espacio** | Consultar expediente personal, asistencia, ausencias, objetivos, evaluaciones, capacitación, reconocimientos, políticas y tareas asignadas. |
| **Expedientes** | Crear y editar perfiles laborales con código `EMP-00001`, contacto, datos personales y referencias de empleo. |
| **Organización** | Administrar departamentos, áreas, equipos, puestos y sedes. Durante la edición de un expediente se pueden crear estos elementos sin salir del formulario. |
| **Vida laboral** | Gestionar contratos, documentos, altas, bajas, checklists, horarios y ausencias. |
| **Desarrollo** | Registrar objetivos, evaluaciones de desempeño, capacitaciones y reconocimientos. |
| **Control** | Configurar ventanas de marcación, revisar asistencia, corregir registros y administrar la guardia semanal. |

Administración e IT pueden corregir o eliminar marcaciones y ausencias, conservando trazabilidad en el historial. Los reportes de RR. HH. permiten filtrar por persona, fecha y departamento, y exportar información en CSV.

## Guardia semanal de asistencia

La guardia se programa por semana ISO y rota entre personas activas para los jueves. La persona asignada puede registrar la asistencia colectiva desde su espacio de RR. HH.; Administración e IT pueden consultar la programación, reasignarla cuando sea necesario y revisar el registro resultante.

La rotación automática evita duplicar guardias de la misma semana y busca no repetir a la persona anterior. Está respaldada por una ejecución programada gratuita. La asignación y la reasignación manual requieren que las reglas actuales de Firestore estén publicadas.

## Solicitudes de actualización

En **Equipo → Actualizaciones**, Administración e IT pueden solicitar que una persona actualice información concreta de un módulo, definir campos esperados y fijar una fecha límite. La persona asignada ve únicamente sus solicitudes y puede marcar las propias como completadas. Las solicitudes que vencen se cierran automáticamente y quedan visibles con su estado.

## Comunicación interna

El acceso de correo está junto a Buscar en el encabezado. El sistema permite bandeja de entrada, enviados, borradores, programación de envío, múltiples destinatarios, lectura, pausa, edición y eliminación de mensajes permitidos. El contador indica mensajes internos no leídos.

Los avisos generales se administran en **Notificaciones**. Administración e IT pueden publicar comunicaciones informativas, importantes o urgentes; todo el Personal puede consultarlas ordenadas por relevancia y fecha.

## Finanzas, impacto y análisis

| Módulo | Capacidades |
|---|---|
| **Finanzas** | Registrar gastos con código `GAS-00001`, comparar ingresos y gastos, y exportar CSV. |
| **Rendimiento** | Consultar un índice compuesto que reúne asistencia, tareas, objetivos, evaluaciones y formación. |
| **Impacto digital** | Estimar transferencia de datos, sesiones, tiempo activo y operaciones por persona y departamento. |
| **Historial** | Consultar movimientos por tipo: pagos, reservas, clientes, Personal, tareas, incidencias, finanzas, RR. HH., seguridad y notificaciones. IT puede eliminar entradas autorizadas. |
| **Accesos y actividad** | Revisar altas de cuenta, inicios y cierres de sesión, además de aplicar la política global de cierre por inactividad. |

## Seguridad y cuentas

SIGES admite inicio de sesión con correo y contraseña, invitaciones, recuperación de contraseña por correo, actualización de nombre y contraseña propia, suspensión de cuentas y control de roles. Las cuentas suspendidas no pueden entrar.

El tiempo máximo de inactividad se configura globalmente en segundos, minutos u horas por Departamento de IT. SIGES registra interacción real y cierra una sesión que supera el límite, incluso cuando se vuelve a abrir el navegador después de un periodo prolongado.

## Automatizaciones supervisadas

En **Administración → Automatizaciones**, los perfiles autorizados pueden crear, editar, pausar, reanudar o eliminar reglas. Las reglas activas se ejecutan automáticamente; las pausadas no producen cambios.

| Automatización inicial | Resultado |
|---|---|
| Rotación semanal de asistencia | Crea o conserva la guardia correspondiente de cada semana. |
| Cierre de solicitudes vencidas | Cambia a vencidas las solicitudes que superan su fecha límite. |
| Vencimiento de contratos | Publica avisos para contratos que vencen dentro de los próximos 30 días. |
| Vencimiento de documentos | Publica avisos para documentos que vencen dentro de los próximos 30 días. |

Cada regla conserva responsable, estado, número de ejecuciones y última ejecución. El control humano prevalece: una persona autorizada puede detener cualquier regla antes de su siguiente ejecución.

## Exportaciones y trazabilidad

SIGES permite exportar informes operativos y de RR. HH. a CSV, y comprobantes de pago a PDF. Los movimientos importantes incluyen responsable, fecha y hora. Los códigos secuenciales ayudan a identificar cada entidad sin depender únicamente del nombre.

## Estado de publicación

Para que todos los módulos recientes funcionen en la plataforma pública, se debe publicar la versión más reciente de `firestore.rules`. Esto habilita guardias, solicitudes de actualización, automatizaciones y sus permisos asociados. Firebase Storage no debe activarse si se desea mantener el uso sin facturación; en ese caso, el correo interno sigue operativo sin adjuntos privados.
