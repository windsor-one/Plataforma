# Manual práctico de SIGES

## Sistema Integral de Gestión Estratégica

**SIGES** es la plataforma empresarial para coordinar la operación diaria, clientes, reservas, pagos, Recursos Humanos, planilla, finanzas, informes, comunicaciones internas, solicitudes y seguridad de acceso.

> **Idea principal:** SIGES conecta los registros entre sí. Un cliente puede originar una reserva; una reserva puede recibir varios pagos; los pagos alimentan las cuentas por cobrar, Finanzas, comprobantes y Centro de Informes. De forma similar, un expediente de personal puede conectarse con organización, horarios, asistencia, ausencias, planilla e informes.

La dirección pública de la plataforma es:

[https://windsor-one.github.io/Plataforma/](https://windsor-one.github.io/Plataforma/)

---

## 1. Acceso y seguridad

Para entrar, cada integrante utiliza su correo institucional o correo autorizado y su contraseña. El sistema valida los permisos durante cada sesión y muestra únicamente las áreas que corresponden al rol y estado de la cuenta.

| Rol | Alcance general |
|---|---|
| **Departamento de IT** | Administra identidades, invitaciones, perfiles, seguridad, accesos, configuración técnica e información administrativa. |
| **Administración** | Gestiona la operación administrativa, Finanzas, Recursos Humanos, informes, planilla, solicitudes, productos, anuncios y procesos autorizados. |
| **Personal** | Utiliza los módulos operativos que tenga habilitados, consulta su información propia, registra actividades autorizadas y participa en las comunicaciones y solicitudes. |

La barra lateral no debe mostrar grupos vacíos. Si una sección no aparece, normalmente significa que el rol actual no tiene permisos para verla o que la administración todavía no ha habilitado ese flujo.

### Recomendaciones de seguridad

No compartas la contraseña, no uses la cuenta de otra persona y no intentes modificar directamente información que no te corresponde. Los movimientos relevantes quedan asociados al usuario que los realiza y muchas operaciones generan registros en el historial.

---

## 2. Cómo orientarse en la pantalla principal

La pantalla principal contiene la navegación lateral, el buscador global y el área de trabajo del módulo seleccionado.

| Área | Para qué sirve |
|---|---|
| **Resumen** | Consultar la operación del día: agenda, cobros, clientes, pendientes y avisos. |
| **Operación diaria** | Trabajar con clientes, reservas, pagos, productos, tareas, incidencias y calendario. |
| **Equipo** | Consultar personal, correo interno, notificaciones y coordinación general. |
| **Recursos Humanos** | Administrar expedientes, organización, horarios, asistencia, ausencias y desarrollo. |
| **Actualizaciones** | Crear y gestionar solicitudes con permisos temporales específicos. |
| **Paneles y análisis** | Acceder a Centro de Informes, Finanzas, Planilla e Impacto digital, según el rol. |
| **Administración / Departamento de IT** | Gestionar configuraciones, identidades, automatizaciones, seguridad e historial. |

El buscador global permite encontrar información dentro de los módulos autorizados. Al elegir un resultado, SIGES intenta abrir directamente el registro encontrado, no solamente la sección general.

---

## 3. Flujo recomendado para la operación diaria

El flujo básico de trabajo es el siguiente:

> **Cliente → Reserva → Pago o cuotas → Cuentas por cobrar → Finanzas e informes → Comprobante o documento descargable.**

### 3.1 Registrar un cliente

Entra en **Operación diaria → Clientes** y selecciona **Nuevo cliente**. Completa nombres, apellidos y los datos de contacto disponibles. Las notas pueden utilizarse para registrar información operativa relevante.

Después de guardar, el cliente puede seleccionarse desde una nueva reserva o desde un registro de pago.

### 3.2 Crear una reserva

Entra en **Operación diaria → Reservas** o usa el botón **Nueva reserva** desde el resumen.

Selecciona el cliente y, si corresponde, el paquete del catálogo. Cuando se selecciona un paquete, SIGES utiliza el precio configurado en el catálogo y muestra la información del producto. También puedes registrar fecha, hora, servicio, duración, modalidad grupal, participantes, estado y notas.

La reserva debe quedar vinculada al cliente y, cuando aplique, al producto seleccionado. Esto permite que los pagos, informes y comprobantes encuentren la información correcta.

### 3.3 Registrar un pago

Entra en **Operación diaria → Pagos** y selecciona **Registrar pago**, o utiliza la acción de registrar una cuota desde una cuenta por cobrar.

El formulario muestra:

- El precio total exacto del paquete o reserva.
- El total pagado anteriormente.
- El importe de la cuota actual.
- El saldo posterior.
- La moneda de la reserva.
- El estado real de liquidación.

Una misma reserva puede recibir varias cuotas. Un pago parcial no debe marcar la reserva como liquidada. La reserva se considera liquidada únicamente cuando el acumulado alcanza exactamente el total correspondiente. Si existe un importe superior, SIGES lo identifica como sobrepago para que pueda revisarse.

La moneda queda vinculada a la reserva. No debe registrarse una cuota en una moneda diferente.

### 3.4 Descargar un comprobante

En la tabla de pagos, utiliza la acción de descarga del registro correspondiente. El comprobante incluye datos reales del sistema, como cliente, reserva, total del paquete, cuotas acumuladas, cuota actual, saldo posterior y estado de liquidación.

Los documentos descargables de SIGES incluyen al pie la leyenda:

> **Obtenido del Sistema SIGES — fecha y hora de la descarga**

---

## 4. Productos y categorías

En **Operación diaria → Productos** se consulta el catálogo de paquetes y servicios. Los productos pueden estar organizados en categorías regulares y promociones.

Administración puede crear, editar o retirar paquetes y ajustar los nombres de las categorías. El precio del producto se reutiliza al crear reservas y pagos; por eso conviene actualizar el catálogo antes de registrar una nueva operación.

Los cambios en el catálogo no deben modificar automáticamente registros históricos que ya fueron registrados con anterioridad.

---

## 5. Finanzas y Centro de Informes

### 5.1 Finanzas

El módulo de **Finanzas** concentra los gastos, ingresos, cuentas por cobrar y movimientos relacionados con la operación. Su información se alimenta de reservas, pagos y gastos registrados en el sistema.

Entre los resultados que puede consultar Administración se encuentran:

- Cuentas por cobrar por cliente y reserva.
- Pagos acumulados y saldos pendientes.
- Gastos por período, estado y categoría.
- Totales por moneda.
- Compromisos y movimientos financieros.
- Balances y reportes financieros generados con la información disponible.

La información debe revisarse por período. Antes de descargar un reporte, selecciona el mes o intervalo correcto y comprueba que los registros visibles correspondan al corte deseado.

### 5.2 Centro de Informes

El **Centro de Informes** es diferente de Finanzas. Finanzas permite gestionar y analizar movimientos contables; el Centro de Informes organiza reportes para consulta y descarga.

Los informes se construyen con datos reales de las colecciones conectadas. Según el rol y la información disponible, puede incluir:

| Categoría | Ejemplos de información |
|---|---|
| **Finanzas** | Cartera, pagos, gastos, compromisos, balances y estados de resultados. |
| **Planilla** | Período, personal, horas, ausencias, pagos y totales. |
| **Recursos Humanos** | Expedientes, contratos, documentos, asistencia, ausencias y desarrollo. |
| **Operación** | Clientes, reservas, tareas, incidencias y actividad. |
| **Comunicaciones** | Correo interno y actividad asociada. |
| **Administración** | Historial, accesos y automatizaciones. |

El usuario puede revisar la vista previa dentro de la plataforma y descargar el documento cuando necesite compartirlo o archivarlo.

---

## 6. Recursos Humanos

El módulo de **Recursos Humanos** conecta el expediente de cada integrante con la estructura organizacional, los horarios, la asistencia y el desarrollo.

### 6.1 Expedientes

En **Recursos Humanos → Expedientes** se consulta o completa la información laboral. Cada persona debe tener un código único con formato secuencial, por ejemplo:

```text
EMP-00001
EMP-00002
EMP-00003
```

El expediente puede incluir cargo, departamento, área, equipo, sede, horario, datos personales laborales, contactos de emergencia y otra información autorizada.

Los códigos no deben reutilizarse ni duplicarse. Si se detecta un código repetido, la corrección debe realizarla Administración o IT siguiendo la secuencia institucional.

### 6.2 Organización

En **Recursos Humanos → Organización**, las unidades se muestran separadas por categoría para evitar mezclar cargos con departamentos, áreas, equipos y sedes.

La estructura recomendada es:

```text
Departamento
└── Área
    └── Equipo
        └── Cargo
```

La jerarquía se calcula usando la relación de supervisión y organización. Una persona que reporta directamente a otra debe aparecer debajo de su supervisor en el organigrama.

### 6.3 Vida laboral

La sección **Vida laboral** reúne la información que acompaña al empleado durante su permanencia en la organización. Allí pueden revisarse contratos, documentos, horarios, asistencia, ausencias, objetivos, evaluaciones, capacitaciones y reconocimientos, según el rol.

La información se presenta por categorías para que no quede todo mezclado en una sola pantalla.

### 6.4 Horarios y modalidad de trabajo

En **Recursos Humanos → Control** o **Horarios**, Administración puede configurar jornadas, hora de entrada, hora de salida, recesos y modalidad de trabajo, incluyendo presencial y home office.

Los horarios deben asignarse al expediente correspondiente para que puedan utilizarse como referencia en asistencia y planilla.

### 6.5 Asistencia y ausencias

La asistencia registra las marcaciones y el día correspondiente. Las ausencias o permisos se gestionan con fechas, estado y responsable de revisión.

Los días se calculan con la fecha laboral local, evitando que una marcación registrada cerca de medianoche aparezca en otro día por una conversión UTC.

### 6.6 Guardia de los próximos tres días

La vista de guardia muestra los tres días siguientes, el responsable asignado y las marcaciones reales disponibles para cada fecha. Es útil para verificar quién debe cubrir una jornada y si existe registro de asistencia.

---

## 7. Planilla

En **Paneles y análisis → Planilla**, Administración puede preparar períodos de pago utilizando información de empleados, contratos, asistencia, horas trabajadas y ausencias.

El flujo recomendado es:

1. Revisar que los expedientes y contratos estén completos.
2. Confirmar horarios y asistencia del período.
3. Revisar ausencias y permisos aprobados.
4. Crear o calcular la planilla del período.
5. Revisar totales, deducciones y estado.
6. Guardar el resultado y descargar el documento si corresponde.

La planilla debe revisarse antes de marcarla como finalizada, especialmente cuando existan registros de asistencia incompletos.

---

## 8. Solicitudes y permisos temporales

El módulo **Actualizaciones** sirve para solicitar que una persona realice una acción concreta sin entregarle permisos generales innecesarios.

### 8.1 Crear una solicitud

Administración o IT debe seleccionar, en orden:

1. La persona responsable.
2. El módulo.
3. El submódulo o área funcional.
4. El alcance: información propia, módulo completo autorizado o registro específico.
5. El registro real, cuando el alcance sea específico.
6. Los campos o resultados esperados.
7. Las acciones permitidas: editar o eliminar.
8. La fecha y hora límite.
9. Las instrucciones de validación.

Ejemplo de solicitud precisa:

> Kevin Hernández puede editar el campo “Horario” del expediente de Nelson Romero, en Recursos Humanos → Expedientes, hasta el 20 de agosto de 2026 a las 19:00. Debe actualizar la jornada presencial y comprobar que el expediente conserve el código EMP-00001.

El sistema carga registros reales cuando están disponibles. Si un submódulo no tiene registros cargados, permite indicar manualmente el ID y el nombre de referencia del documento.

### 8.2 Ciclo de vida de una solicitud

Una solicitud puede estar pendiente, aprobada, rechazada, cancelada, completada o vencida. Cuando se completa, vence, se cancela o se elimina, el permiso temporal asociado deja de estar vigente o se revoca.

La persona asignada recibe la notificación interna correspondiente y puede consultar el alcance autorizado.

---

## 9. Correo interno

El módulo **Equipo → Correo** permite enviar mensajes internos entre integrantes activos.

Las carpetas principales son:

| Carpeta | Uso |
|---|---|
| **Bandeja de entrada** | Mensajes recibidos. |
| **Enviados** | Mensajes enviados por ti. |
| **Borradores** | Mensajes guardados sin envío definitivo. |
| **Programados** | Mensajes con entrega futura. |
| **Papelera** | Mensajes enviados a la basura. |

Actualmente el correo funciona sin archivos adjuntos para mantener la solución dentro del plan gratuito de Firebase.

Para eliminar un mensaje, selecciona **Enviar a papelera**. Desde la papelera puedes **Restaurar** o **Eliminar definitivamente** el mensaje de tu propio buzón. La eliminación definitiva no borra automáticamente la copia que otros participantes puedan conservar.

---

## 10. Tareas, incidencias y calendario

En **Operación diaria** se gestionan tareas e incidencias relacionadas con la operación. Las tareas pueden asignarse y avanzar por estados; las incidencias permiten reportar situaciones que requieren revisión.

El calendario concentra la agenda de reservas y permite abrir el registro relacionado. La información visible depende de los permisos del usuario y de los datos registrados.

---

## 11. Editar varios

El botón **Editar varios** solo aparece en secciones donde hay acciones masivas implementadas.

El flujo es:

1. Entra en Clientes, Pagos o Personal, según tu rol.
2. Pulsa **Editar varios**.
3. Marca una o varias casillas.
4. Elige la acción disponible.
5. Confirma la operación si el sistema lo solicita.
6. Revisa el mensaje de resultado y el Historial.

En Clientes se pueden actualizar notas o eliminar registros cuando el rol lo permita. En Pagos se pueden actualizar estados de registros editables; los pagos confirmados pueden requerir una solicitud de ajuste individual. En Personal administrado por IT se pueden activar, suspender o eliminar perfiles que cumplan las condiciones de seguridad.

---

## 12. Historial, accesos e impacto digital

El **Historial** muestra movimientos relevantes y sus responsables. Sirve para saber quién creó, actualizó o gestionó un registro.

El módulo de **Accesos** permite a IT revisar eventos de inicio, cierre y creación de cuentas. El panel de **Impacto digital** presenta una estimación informativa basada en el uso del navegador y no debe interpretarse como una medición física o certificación ambiental.

---

## 13. Descarga de documentos

Desde los módulos correspondientes puedes descargar comprobantes, informes financieros, reportes de Recursos Humanos, planilla y otros documentos disponibles.

Antes de descargar:

- Comprueba el período seleccionado.
- Revisa que el documento muestre datos reales y no un estado vacío inesperado.
- Confirma que el cliente, empleado, reserva o pago sea el correcto.
- Verifica la fecha y hora del documento.
- Comprueba que el pie incluya “Obtenido del Sistema SIGES — fecha y hora de la descarga”.

---

## 14. Solución rápida de problemas

| Problema | Acción recomendada |
|---|---|
| La pantalla muestra un error antiguo | Recarga con **Ctrl + F5**, cierra sesión y vuelve a entrar. |
| Una sección no aparece | Revisa el rol y el estado de la cuenta; la barra lateral oculta grupos sin contenido autorizado. |
| No aparece un registro en una solicitud | Verifica que la colección tenga datos cargados para tu rol; si no, usa el ID real y la referencia manual. |
| Un pago parcial aparece como liquidado | Revisa que el total de la reserva y todas las cuotas estén guardados correctamente; el estado se calcula con el acumulado. |
| El correo no permite adjuntos | Es el comportamiento esperado para mantener el sistema dentro del plan gratuito. Envía el contenido en el cuerpo del mensaje. |
| Un informe aparece vacío | Comprueba el mes, período y permisos. El Centro de Informes solo muestra datos disponibles en las colecciones conectadas. |
| Una solicitud deja de permitir cambios | Puede haber vencido, sido cancelada, rechazada, completada o eliminada. |
| El aviso indica sincronización pendiente | Recarga la plataforma. Si continúa, cierra sesión y vuelve a iniciar sesión. |

---

## 15. Buenas prácticas de trabajo

SIGES funciona mejor cuando cada registro se crea una sola vez y luego se reutiliza mediante vínculos. Evita escribir nombres diferentes para la misma persona, producto o cliente. Registra primero el cliente, luego la reserva y finalmente los pagos relacionados.

En Recursos Humanos, completa primero la estructura organizacional y los códigos de expediente. Después asigna cargos, horarios y responsables. La asistencia y la planilla dependen de esa base.

En solicitudes, evita instrucciones generales como “arreglar RR. HH.”. Indica siempre el módulo, submódulo, registro, campo, acción, resultado esperado y fecha límite.

En Finanzas y Centro de Informes, revisa los períodos antes de descargar documentos. En correo, utiliza papelera antes de eliminar definitivamente. En todos los módulos, verifica que la operación haya generado el mensaje de confirmación y, cuando corresponda, una entrada en Historial.

---

## Resumen final

SIGES es un sistema transversal: no se limita a guardar información aislada, sino que conecta la operación diaria, las finanzas, el personal, las comunicaciones y la administración. El flujo correcto consiste en registrar información real, vincularla con el módulo correspondiente, respetar los permisos del rol, revisar el resultado y descargar los documentos cuando sean necesarios.

> **SIGES: una sola plataforma para organizar, operar, controlar y documentar la gestión estratégica de la empresa.**
