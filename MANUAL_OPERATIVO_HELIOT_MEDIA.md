# Manual integral de Sistema Heliot

> **Propósito.** Este documento permite operar, mantener y recuperar Sistema Heliot sin depender de una persona específica. Guárdelo junto con el repositorio y actualícelo cuando cambie una regla, una colección, un rol o un proceso de trabajo.

| Dato | Valor actual |
| --- | --- |
| Nombre de la plataforma | **Sistema Heliot** |
| Desarrollado por | Windsor |
| Publicación | GitHub Pages |
| URL pública | `https://windsor-one.github.io/Plataforma/` |
| Repositorio | `windsor-one/Plataforma` |
| Proyecto Firebase | `gestionpro-firebase` |
| Base de datos | Cloud Firestore, base `(default)` |
| Autenticación | Correo electrónico y contraseña |
| Plan de despliegue | GitHub Pages + Firebase Spark, sin servidor propio |
| Rama que publica | `main` |

---

## Índice

1. [Qué hace la plataforma](#1-qué-hace-la-plataforma)
2. [Roles y permisos](#2-roles-y-permisos)
3. [Guía diaria para Personal](#3-guía-diaria-para-personal)
4. [Guía administrativa e IT](#4-guía-administrativa-e-it)
5. [Módulos operativos](#5-módulos-operativos)
6. [Pagos, anticipos, saldo y comprobantes PDF](#6-pagos-anticipos-saldo-y-comprobantes-pdf)
7. [Productos, aranceles y promociones](#7-productos-aranceles-y-promociones)
8. [Notificaciones internas](#8-notificaciones-internas)
9. [Auditoría, historial y accesos](#9-auditoría-historial-y-accesos)
10. [Estructura de datos en Firestore](#10-estructura-de-datos-en-firestore)
11. [Firebase: configuración, reglas y recuperación](#11-firebase-configuración-reglas-y-recuperación)
12. [GitHub Pages: despliegue y recuperación](#12-github-pages-despliegue-y-recuperación)
13. [Mantenimiento técnico del código](#13-mantenimiento-técnico-del-código)
14. [Solución de problemas](#14-solución-de-problemas)
15. [Checklist de continuidad](#15-checklist-de-continuidad)

---

## 1. Qué hace la plataforma

Sistema Heliot centraliza la gestión de clientes, reservas, paquetes, pagos, personal, comunicaciones internas y trazabilidad operativa. La información se sincroniza con Firestore en tiempo real y cada operación principal conserva el usuario y la hora de registro.

| Área | Función principal |
| --- | --- |
| Resumen | Muestra agenda del día, cobros, clientes, pendientes, avisos y distribución de pagos. |
| Clientes | Directorio con nombres, apellidos, contacto, notas y código secuencial `CLI-00001`. |
| Reservas | Agenda con códigos `RES-00001`, productos, grupos, responsables, estado y notas. |
| Pagos | Cobros con códigos `PAG-00001`, anticipos, pagos parciales, saldos y comprobantes PDF. |
| Productos | Catálogo de aranceles y promociones disponible para todo el Personal. |
| Notificaciones | Comunicaciones internas ordenadas por urgencia y fecha. |
| Personal | Directorio de perfiles activos, suspendidos e invitaciones pendientes. |
| Recursos Humanos | Expedientes, organización, asistencia, ausencias, contratos, formación y políticas con privacidad por titular. |
| Operación | Asignación de responsables y control de reservas grupales. |
| Tareas | Plan de trabajo e incidencias vinculables a reservas, con responsables, prioridades y seguimiento. |
| Finanzas | Lectura administrativa de ingresos, gastos, flujo y exportación CSV. |
| Búsqueda global | Acceso directo por nombre, código, servicio, pago, tarea, incidencia o gasto. |
| Historial | Movimientos auditables de la plataforma. |
| Accesos | Línea de tiempo de creación de cuenta, accesos y actividad operativa. |

### Regla de oro

> **No edite Firestore manualmente salvo que sea imprescindible.** Utilice primero los formularios de la plataforma. Eso conserva códigos, autoría, fechas, historial y consistencia entre módulos.

---

## 2. Roles y permisos

Actualmente existen dos roles técnicos. En la interfaz, el valor `admin` se presenta como **Administración / IT**.

| Acción o panel | Personal | Administración / IT |
| --- | --- | --- |
| Iniciar sesión si su estado es activo | Sí | Sí |
| Ver Resumen, Clientes, Reservas, Pagos y Productos | Sí | Sí |
| Crear, editar y eliminar clientes, reservas y pagos | Sí | Sí |
| Consultar Productos | Sí | Sí |
| Crear, editar o retirar Productos | No | Sí |
| Leer Notificaciones | Sí | Sí |
| Publicar, editar o eliminar Notificaciones | No | Sí |
| Ver Personal, invitaciones y perfiles | No | Sí |
| Invitar, suspender o cambiar rol de Personal | No | Sí |
| Enviar enlace de recuperación de contraseña | No | Sí |
| Ver tareas propias y reportar incidencias | Sí | Sí |
| Crear, asignar, editar o archivar tareas | No | Sí |
| Gestionar incidencias reportadas | No | Sí |
| Consultar o gestionar Finanzas y gastos | No | Sí |
| Ver y actualizar sus datos de contacto de RR. HH. | Sí, solo los propios | Sí |
| Ver asistencia, ausencias, objetivos, formación y evaluaciones | Sí, solo los propios | Sí, de todo el Personal |
| Marcar entrada, salida y descansos | Sí, solo propios | Sí |
| Solicitar vacaciones o permisos | Sí, solo propios | Sí |
| Aprobar ausencias, administrar expedientes, contratos, documentos y salarios | No | Sí |
| Crear estructura, políticas, onboarding, desarrollo y reconocimientos | No | Sí |
| Usar búsqueda global | Sí, en sus módulos autorizados | Sí, incluido Finanzas |
| Ver Operación, Historial y Accesos | No | Sí |
| Eliminar un movimiento del Historial | No | Sí |

Un perfil suspendido no puede operar aunque conozca su correo y contraseña. El cambio de rol, correo o estado se realiza desde **Personal** y nunca desde el perfil individual del empleado.

> **Matriz de privacidad de RR. HH.** En esta versión, el rol técnico `admin` se presenta como **Administración/IT** y concentra las funciones de RR. HH. por seguridad. Personal nunca ve contratos, salarios, documentos privados, expedientes de terceros ni evaluaciones ajenas. Cuando la organización necesite responsables de equipo, se recomienda crear un rol técnico adicional de Supervisor antes de concederles acceso a datos de otras personas.

---

## 3. Guía diaria para Personal

### 3.1 Iniciar sesión

1. Abra `https://windsor-one.github.io/Plataforma/`.
2. Escriba su correo laboral y contraseña.
3. Use el icono de ojo junto al campo de contraseña si necesita comprobar lo que escribió.
4. Presione **Iniciar sesión**.

Si olvidó la contraseña, escriba su correo y pulse **¿Olvidaste tu contraseña? Restablécela por correo**. El enlace llega al correo registrado. También puede pedir a Administración/IT que envíe el enlace desde **Personal**.

> Las contraseñas no se muestran ni se almacenan legibles. Administración/IT puede iniciar un restablecimiento seguro, pero no puede ver la clave anterior de ningún integrante.

### 3.2 Crear un cliente

1. Abra **Clientes** y pulse **Nuevo cliente**.
2. Registre **Nombres** y **Apellidos** por separado.
3. Añada correo, teléfono y notas si están disponibles.
4. Presione **Guardar cliente**.

El sistema asigna un código `CLI-xxxxx`. Puede ordenar la tabla por nombres o apellidos, en ambos sentidos. Al pulsar una fila se abre la ficha completa del cliente.

### 3.3 Crear una reserva

1. Abra **Reservas** y seleccione **Nueva reserva**.
2. Elija un cliente existente o pulse **Registrar cliente en panel lateral** sin cerrar el formulario.
3. Seleccione un paquete, o deje el servicio personalizado si no hay paquete aplicable.
4. Indique fecha, hora, duración, estado y notas.
5. Para una reserva grupal, active **Reserva grupal**, escriba el nombre del grupo, el número de participantes y los integrantes si se conocen.
6. Guarde la reserva.

Las reservas grupales con **cinco o más participantes** registran automáticamente el beneficio de fotografía grupal adicional. Cada reserva recibe un código `RES-xxxxx`.

### 3.4 Registrar un pago

1. Abra **Pagos** y pulse **Registrar pago**.
2. Seleccione el cliente y, cuando exista, la reserva relacionada.
3. Elija el paquete si corresponde.
4. Seleccione el tipo: **Anticipo**, **Pago parcial**, **Liquidación de saldo** o **Pago completo**.
5. Revise el bloque **Control de saldo** antes de guardar.
6. Escriba importe, moneda, método, estado, fecha y notas.
7. Guarde el pago.

Para descargar el comprobante, ubique el pago en la tabla y presione el icono de documento. El PDF se genera directamente en el navegador y usa el código de pago como referencia.

### 3.5 Consultar tareas y reportar incidencias

Abra **Tareas** para ver el trabajo que Administración/IT le haya asignado. Actualice únicamente el estado cuando avance, requiera revisión o complete una tarea. Para documentar un bloqueo, seleccione **Reportar incidencia**, describa lo ocurrido, elija la prioridad y vincule una reserva cuando aplique. El reporte queda disponible para seguimiento administrativo; no sustituye los canales de emergencia de la organización.

### 3.6 Usar Recursos Humanos

Abra **Recursos Humanos → Mi espacio** para consultar su estado laboral, código, cargo, área y días de vacaciones registrados. Desde allí puede actualizar sus datos personales de contacto, marcar entrada, salida o descansos y solicitar vacaciones o permisos. También puede revisar los objetivos, capacitaciones, evaluaciones y políticas que Administración/IT haya compartido con usted.

No incorpore en el campo de motivos de ausencia diagnósticos médicos, números de identidad, claves ni información confidencial. Para evidencias o documentación clínica, siga el proceso privado definido por Administración/IT fuera de los campos generales de la plataforma.

### 3.7 Marcar asistencia y conservar la sesión

Las acciones **Registrar entrada**, **Registrar salida**, **Iniciar descanso** y **Finalizar descanso** aplican la ventana configurada por Administración/IT. Cada evento tiene un límite diario por persona y tipo. Si intenta registrar fuera de horario o superar el límite, Sistema Heliot muestra el motivo y no crea el movimiento.

El cierre de sesión se calcula desde la última interacción real con la plataforma. La fecha se conserva localmente por dispositivo y se verifica al regresar a una pestaña, abrir el navegador o reanudar el equipo. Un navegador o equipo apagado no puede ejecutar un cierre activo mientras está apagado; al volver a abrir Sistema Heliot, la sesión se invalida antes de mostrar datos si el plazo configurado ya venció.

---

## 4. Guía administrativa e IT

### 4.1 Invitar a una persona

1. Abra **Personal**.
2. Presione **Invitar personal**.
3. Escriba nombre completo, correo, rol y, si corresponde, estado inicial.
4. Guarde la invitación.
5. Indique a la persona que abra la plataforma, elija **¿Tienes una invitación? Regístrate** y use el mismo correo.

La invitación queda como **pendiente** hasta que la persona cree su cuenta. Cuando completa el registro, el perfil se crea automáticamente en `users`, se habilita el acceso y se registra el evento en Historial y Accesos.

### 4.2 Suspender o reactivar a una persona

1. En **Personal**, pulse editar en la fila correspondiente.
2. Cambie **Estado** a `Suspendido` o `Activo`.
3. Guarde los cambios.

Suspender el perfil es preferible a eliminarlo cuando se necesita conservar trazabilidad. Un perfil suspendido deja de poder iniciar sesión y tampoco puede leer ni escribir módulos operativos.

### 4.3 Cambiar correo de una persona

Firebase Authentication no permite cambiar el correo de otra persona desde este sitio estático. El flujo aplicado por la plataforma es seguro:

1. Edite el integrante en **Personal**.
2. Escriba el nuevo correo.
3. La plataforma prepara una nueva invitación y suspende el acceso anterior.
4. La persona registra la nueva cuenta con el correo actualizado.

### 4.4 Recuperar contraseña de Personal

1. En **Personal**, ubique al integrante.
2. Presione el icono de candado **Enviar restablecimiento de contraseña**.
3. Confirme con la persona que recibió el correo.
4. La persona abre el enlace y define una contraseña nueva.

No comparta contraseñas por chat ni cree una colección de contraseñas en Firestore. Eso rompería el modelo de seguridad de Firebase Authentication.

### 4.5 Asignar responsables

1. Abra **Operación**.
2. En la fila de la reserva, elija un integrante activo en el selector de responsable.
3. El cambio se guarda dentro de la reserva y queda visible en su ficha.

### 4.6 Gestionar actividad e historial

**Historial** presenta los movimientos administrativos y operativos. Pulse una fila para ver su ficha y el registro vinculado. Administración/IT puede eliminar un movimiento de Historial con el icono de eliminación; utilice esta facultad solo cuando exista una razón operacional clara, porque esa entrada deja de ser recuperable desde la interfaz.

**Accesos** combina creación de cuentas, inicios de sesión y movimientos operativos. Es el punto de consulta para saber qué actividad ha habido, quién la registró y cuándo ocurrió.

### 4.7 Coordinar tareas e incidencias

1. Abra **Tareas** y use **Nueva tarea** para definir resultado, prioridad, responsable y fecha límite.
2. Vincule una reserva cuando la entrega dependa de un servicio concreto.
3. Revise las incidencias reportadas por el Personal, asigne un responsable y cambie el estado hasta resolver o cerrar el caso.
4. Archive tareas o incidencias solo cuando ya no deban estar en el tablero activo; el movimiento se conserva en Historial.

### 4.8 Registrar y revisar finanzas

1. Abra **Finanzas** y seleccione el período.
2. Use **Registrar gasto** para guardar concepto, categoría, importe, estado, fecha, método y referencia operativa.
3. Marque como **Pendiente** lo aún no pagado y como **Pagado** cuando salga de caja.
4. Revise el flujo de caja, los compromisos y el resultado proyectado.
5. Use **Exportar CSV** para conciliación interna o para compartir con el responsable contable.

> El panel financiero es una lectura administrativa. No reemplaza libros contables, obligaciones fiscales ni asesoría profesional.

### 4.9 Administrar Recursos Humanos

1. Abra **Recursos Humanos → Expedientes** y complete primero el código, cargo, departamento, fecha de ingreso, modalidad, jornada y vacaciones de cada integrante.
2. Defina departamentos, áreas, equipos, cargos, sedes y horarios desde **Organización**.
3. Registre contratos, vigencias y referencias documentales en **Vida laboral**. El importe salarial se conserva exclusivamente para Administración/IT.
4. Revise solicitudes de vacaciones y permisos desde **Control**. La aprobación o rechazo queda registrada en Historial.
5. Utilice **Desarrollo** para crear objetivos, evaluaciones, capacitaciones, reconocimientos y políticas con versión.
6. Mantenga los documentos físicos o sus enlaces en un repositorio autorizado; la plataforma guarda el expediente, estado y vigencia, no sustituye el almacenamiento documental seguro.

### 4.10 Configurar asistencia, códigos y expedientes

Los expedientes nuevos reciben automáticamente un código `EMP-xxxxx`. El campo no se escribe a mano y el número se controla en la secuencia global de empleados. Los expedientes existentes conservan su código histórico para no afectar datos ya registrados.

Primero cree **Departamentos, Áreas, Equipos, Cargos, Sedes y Horarios** en **Recursos Humanos → Organización**. Después selecciónelos desde el panel lateral de Expedientes. Evite usar nombres libres: los selectores reutilizan la misma estructura organizacional.

En **Recursos Humanos → Control**, Administración/IT puede definir para entrada, salida e inicio/fin de descanso la hora inicial, la hora final y el máximo de registros por día. El valor inicial es de 07:00 a 12:00 y una vez diaria por tipo. Los límites se validan antes de crear la marcación.

### 4.11 Corregir registros, emitir reportes y revisar rendimiento

Administración/IT tiene control operativo sobre los registros de Recursos Humanos. Desde **Recursos Humanos → Control** puede crear, editar o eliminar marcaciones y ausencias cuando una persona registre tarde, no tenga conexión o cometa un error. Una corrección debe llevar un motivo: el sistema conserva quién realizó el ajuste, cuándo y qué registro cambió en Historial.

El módulo **Reportes RR. HH.** permite filtrar por rango de fechas, persona y departamento; incluye marcaciones, correcciones y ausencias, con exportación CSV de cada vista. El módulo **Rendimiento** combina solo información ya registrada: avance de tareas, objetivos, capacitaciones, evaluaciones y marcaciones. El indicador resultante es una lectura de seguimiento, no una decisión automática ni una evaluación disciplinaria.

---

## 5. Módulos operativos

### 5.1 Resumen

El Resumen no reemplaza los módulos detallados. Sirve para priorizar la jornada con las reservas activas del día, cobros confirmados, clientes registrados, pendientes, avisos internos y la distribución de pagos por método.

### 5.2 Clientes

Los clientes mantienen nombre y apellido separados para facilitar filtros y listados. Si se importan datos antiguos con `fullName`, la plataforma conserva compatibilidad visual, pero los nuevos registros deben usar los dos campos separados.

### 5.3 Reservas individuales y grupales

Una reserva vincula cliente, servicio, fecha, hora, estado y paquete. Una reserva grupal agrega `groupName`, `groupSize`, `participantNames` y el indicador `groupBonusEligible`. Para un paquete por persona, el total puede calcularse según la cantidad de participantes; confirme siempre el importe final antes de cobrar.

### 5.4 Operación

El panel Operación no crea permisos nuevos: concentra las reservas para que Administración/IT distribuya responsables y supervise grupos. Personal realiza el trabajo asignado desde sus módulos operativos habituales.

### 5.5 Tareas e incidencias

Cada tarea usa el código secuencial `TAR-xxxxx` y conserva prioridad, estado, responsable, fecha límite y vínculo opcional a una reserva. Administración/IT puede crear, asignar, editar y archivar; Personal solo puede consultar sus tareas asignadas y actualizar el estado.

Las incidencias usan el código `INC-xxxxx`. Todo integrante activo puede reportar una incidencia propia. Administración/IT asigna, investiga, resuelve o cierra el registro. Utilice descripciones concretas y evite escribir contraseñas, datos bancarios completos o información personal innecesaria.

### 5.6 Búsqueda global

El botón **Buscar** del encabezado y el atajo `Ctrl + K` (o `Cmd + K`) permiten encontrar clientes, reservas, pagos, tareas e incidencias por código o texto. Administración/IT también puede encontrar gastos. La búsqueda no concede acceso adicional: cada resultado respeta los permisos del perfil activo.

### 5.7 Finanzas

**Finanzas** reúne los pagos confirmados y los gastos activos por período. Los indicadores se interpretan así:

| Indicador | Cálculo operativo |
| --- | --- |
| Ingresos cobrados | Pagos con estado `paid` en el período. |
| Egresos pagados | Gastos con estado `paid` en el período. |
| Flujo de caja | Ingresos cobrados menos egresos pagados. |
| Resultado proyectado | Ingresos cobrados menos gastos pagados y aprobados. |
| Por comprometer | Gastos con estado `pending`. |

Archivar un gasto lo retira de la lectura activa, sin borrar el documento ni el movimiento de auditoría. Los CSV incluyen pagos y gastos del período elegido; deben revisarse antes de usarse como soporte contable.

### 5.8 Recursos Humanos

El centro **Recursos Humanos** cubre una primera capa del ciclo laboral: expediente, estructura, asistencia manual, ausencias, horarios, contratos, documentos de referencia, onboarding/offboarding, objetivos, desempeño, capacitación, reconocimiento y políticas. La interfaz personal muestra únicamente los datos de la cuenta activa; Administración/IT puede gestionar la vista institucional.

| Submódulo | Personal activo | Administración/IT |
| --- | --- | --- |
| Mi expediente | Consulta y actualización de contacto propio | Expediente completo de todas las personas |
| Asistencia | Crea y consulta sus marcaciones | Consulta el conjunto y realiza ajustes administrativos |
| Ausencias | Crea y consulta solicitudes propias | Aprueba, rechaza y revisa todas las solicitudes |
| Contratos y documentos | Sin acceso a información sensible | Crea, consulta y mantiene registros |
| Desarrollo | Ve sus propios objetivos, evaluación y formación | Asigna y administra para todo el Personal |
| Políticas | Lee versiones activas y confirma recepción | Publica y controla versiones |

Los contratos, salarios y documentos se restringen a Administración/IT. Esta decisión es deliberada: el actual rol `personal` no equivale a RR. HH. ni a supervisor. Antes de habilitar accesos jerárquicos, se debe crear y probar un rol adicional con reglas específicas.

### 5.9 Reportes y rendimiento

| Módulo | Acceso | Finalidad | Límite de interpretación |
| --- | --- | --- | --- |
| **Reportes RR. HH.** | Administración/IT | Consulta y exportación de marcaciones, correcciones y ausencias filtradas. | Las marcaciones son eventos capturados, no una prueba completa de horas trabajadas. |
| **Rendimiento** | Administración/IT | Resume tareas, objetivos, formación, evaluaciones y actividad disponible. | La ausencia de datos no equivale a desempeño bajo; requiere revisión humana y contexto. |

> La herramienta no realiza puntuaciones disciplinarias, decisiones de contratación, despido, compensación ni promociones de forma automática. Administración/IT debe revisar ausencias aprobadas, cargas de trabajo, contexto operativo y comentarios antes de interpretar cualquier indicador.

---

## 6. Pagos, anticipos, saldo y comprobantes PDF

| Tipo de pago | Uso recomendado |
| --- | --- |
| Anticipo | Primer abono para reservar fecha o paquete. |
| Pago parcial | Abono intermedio cuando faltan pagos posteriores. |
| Liquidación de saldo | Pago que cubre la parte restante. |
| Pago completo | Cobro total en una sola operación. |

El control de saldo se calcula al asociar el pago con una reserva. El sistema toma el valor total de la reserva o del paquete, suma los pagos confirmados anteriores y muestra el saldo esperado después del pago actual. Verifique que el pago esté asociado a la reserva correcta antes de guardar.

### Comprobantes PDF

Cada pago puede descargar un comprobante PDF con código, cliente, fecha, paquete o servicio, método de pago, importe, total estimado y saldo pendiente. Es un **comprobante operativo de pago**. Si se requieren documentos fiscales oficiales, la organización debe integrar un proveedor fiscal autorizado y definir su flujo contable.

---

## 7. Productos, aranceles y promociones

El panel **Productos** está disponible a todo el Personal para consulta. Solo Administración/IT puede crear, editar o retirar paquetes.

### Catálogo base incluido

| Categoría | Paquete | Precio | Unidad |
| --- | --- | ---: | --- |
| Aranceles | Paquete Básico | USD 5.00 | por persona |
| Aranceles | Paquete Amigos / Dúo | USD 8.00 | por pareja |
| Aranceles | Premium Plus | USD 10.00 | por persona |
| Promociones | Paquete Básico — Día del Alumno | USD 1.00 | promoción especial |
| Promociones | Paquete Amigos — Día del Alumno | USD 1.75 | promoción especial |
| Promociones | Paquete Premium — Día del Alumno | USD 2.25 | promoción especial |
| Promociones | Estrella Heliot | USD 3.00 | estrella |

Para crear un paquete, use **Nuevo paquete**, seleccione `Aranceles` o `Promociones`, defina nombre, precio, unidad, subtítulo y cada inclusión en una línea con el formato `Título: detalle`.

Los paquetes base existen en código y los productos guardados en Firestore pueden sobrescribirlos por el mismo identificador. Retirar un paquete lo marca como inactivo para que deje de mostrarse, sin alterar los registros históricos que ya guardaron su nombre y precio.

---

## 8. Notificaciones internas

**Notificaciones** es el canal interno de anuncios, recordatorios y comunicaciones operativas. Todo el Personal puede leerlo. Administración/IT puede crear, editar y eliminar avisos.

| Prioridad | Cuándo usarla |
| --- | --- |
| Urgente | Cambio inmediato que afecta la operación del día. |
| Importante | Información que debe leerse pronto, sin detener la operación. |
| Informativo | Aviso general o recordatorio ordinario. |

Los avisos se ordenan primero por prioridad y luego por fecha. Un anuncio debe tener asunto concreto, mensaje accionable y contexto suficiente; evite publicar contraseñas, datos bancarios o información personal innecesaria.

---

## 9. Auditoría, historial y accesos

### Cierre automático por inactividad

La plataforma protege sesiones abiertas sin supervisión. Cuando transcurre el intervalo global sin interacción —por ejemplo, sin tocar, hacer clic, escribir, desplazarse o volver a enfocar la pestaña— Heliot Media muestra un aviso durante el último minuto. Si la persona no pulsa **Continuar sesión** ni realiza una acción, la plataforma registra el cierre e inicia la salida de Firebase Authentication. Para volver a operar debe iniciar sesión otra vez.

Administración/IT configura este intervalo desde **Accesos y actividad → Cierre automático por inactividad**. Puede seleccionar un valor y usar **segundos, minutos u horas**; los rangos admitidos son 10–3,600 segundos, 1–1,440 minutos o 1–24 horas. La política se guarda en `securitySettings/global` y se sincroniza con las sesiones activas. Personal puede recibir la política, pero no cambiarla. Esta medida se aplica en el navegador y no sustituye las reglas de Firestore: al cerrar la sesión, las reglas también dejan de permitir lecturas o escrituras protegidas.

### Huella digital estimada

Sistema Heliot muestra una **estimación informativa de emisiones asociadas al uso digital**. El navegador registra una vez por sesión los bytes transferidos al cargar y utilizar la aplicación, y los convierte a CO₂e con un factor visible de **148.2 g CO₂e/GB**. Ese factor proviene de sumar las intensidades operativas y embebidas de centros de datos, redes y dispositivos del Sustainable Web Design Model v4 (0.300 kWh/GB) y multiplicarlas por la intensidad eléctrica global de 494 g CO₂e/kWh publicada por su metodología [1].

| Vista | Acceso | Información disponible |
| --- | --- | --- |
| **Impacto digital** | Cada integrante activo | Sus propias sesiones, transferencia observada y acumulado estimado. |
| **Impacto digital** | Solo Administración/IT | Consolidado y desglose cronológico acumulado por integrante. |
| **Mi perfil** | Cada integrante activo | Resumen breve de su acumulado estimado. |

> **Límite esencial:** esta función no mide electricidad real, fabricación de hardware ni emisiones verificadas. Es una estimación de transferencia observada por el navegador; los recursos en caché, extensiones, actividad fuera de la aplicación o limitaciones del dispositivo pueden no quedar reflejados. La plataforma no debe usarla para afirmaciones de neutralidad, compensación o reportes corporativos auditados [1] [2].

### Qué queda registrado

| Fuente | Eventos principales |
| --- | --- |
| `activityLogs` | Creación, edición y archivo de clientes, reservas, pagos, productos, tareas, incidencias, gastos y avisos; invitaciones; cambios de perfil; alta de cuenta. |
| `accessLogs` | Creación de cuenta, inicio de sesión y futuros eventos de acceso compatibles. |
| Registros operativos | Usuario creador, correo, fecha de creación y última actualización. |

La creación de una cuenta nueva produce dos registros: uno en **Historial** y otro en **Accesos**. La sección Accesos combina ambas fuentes para mostrar una cronología de alto nivel por integrante.

### Límites de la auditoría

Los registros históricos ya existentes, creados antes de habilitar una nueva función de auditoría, no se reconstruyen automáticamente. La trazabilidad completa empieza desde la fecha en que cada función fue publicada. No borre documentos de `activityLogs` salvo que Administración/IT haya decidido hacerlo conscientemente desde la interfaz.

---

## 10. Estructura de datos en Firestore

| Colección | Finalidad | Campos clave |
| --- | --- | --- |
| `users` | Perfiles de integrantes | `email`, `displayName`, `role`, `status`, fechas. |
| `invitations` | Invitaciones antes del registro | `email`, `displayName`, `role`, `status`, `invitedBy`. |
| `customers` | Clientes | `code`, `firstName`, `lastName`, contacto, notas, autoría. |
| `reservations` | Reservas | `code`, cliente, paquete, fecha, estado, grupo, asignación, `totalDue`. |
| `payments` | Cobros | `code`, cliente, reserva, importe, tipo, método, estado y fecha. |
| `products` | Paquetes editables | categoría, precio, unidad, inclusiones y estado activo. |
| `generalReminders` | Notificaciones internas | título, mensaje, prioridad, creador y fechas. |
| `hrProfiles` | Expediente privado | código, cargo, organización, modalidad, vacaciones y datos de contacto. |
| `organizationUnits` | Estructura organizacional | departamentos, áreas, equipos, cargos y sedes. |
| `workSchedules` | Horarios y turnos | días, inicio, fin y descanso. |
| `employmentContracts` | Contratos laborales | vigencia, cargo, modalidad, jornada y salario administrativo. |
| `hrDocuments` | Expediente documental | tipo, estado, emisión, vencimiento y referencia segura. |
| `attendanceRecords` | Marcaciones personales | titular, tipo, origen y hora. |
| `leaveRequests` | Vacaciones y permisos | tipo, fechas, días, estado y revisor. |
| `lifecycleChecklists` | Onboarding/offboarding | etapa, paso, responsable y vencimiento. |
| `hrGoals` / `performanceReviews` | Desarrollo y desempeño | titular, objetivo, progreso, período y evaluación. |
| `trainingRecords` / `recognitions` | Formación y reconocimiento | titular, estado, proveedor, logro y visibilidad. |
| `hrPolicies` / `policyAcknowledgments` | Políticas y aceptación | versión activa, contenido, titular y confirmación. |
| `tasks` | Trabajo operativo asignado | `code`, título, prioridad, estado, responsable, fecha límite y reserva. |
| `incidents` | Bloqueos y seguimiento | `code`, descripción, prioridad, estado, responsable y reserva. |
| `expenses` | Libro de gastos administrativo | `code`, concepto, categoría, importe, estado, fecha y referencias. |
| `activityLogs` | Historial administrativo | acción, entidad, resumen, actor y hora. |
| `accessLogs` | Accesos y alta de cuenta | usuario, correo, rol, evento y hora. |
| `carbonUsage` | Estimaciones de uso digital | usuario, bytes observados, sesiones, CO₂e estimado, factor y fecha. |
| `sequences` | Contadores de código | contador por categoría: clientes, reservas, pagos, tareas, incidencias y gastos. |

### Códigos secuenciales

| Tipo | Formato |
| --- | --- |
| Cliente | `CLI-00001` |
| Reserva | `RES-00001` |
| Pago | `PAG-00001` |
| Tarea | `TAR-00001` |
| Incidencia | `INC-00001` |
| Gasto | `GAS-00001` |

No elimine ni reduzca manualmente los documentos de `sequences` porque podría generar códigos repetidos. Para corregir un código, mantenga el contador por encima del número más alto ya utilizado.

---

## 11. Firebase: configuración, reglas y recuperación

### 11.1 Servicios que deben estar activos

1. **Authentication** con el proveedor **Correo electrónico/contraseña** habilitado.
2. **Cloud Firestore** en la base `(default)`.
3. Dominio `windsor-one.github.io` incluido en los dominios autorizados de Authentication.
4. Reglas del archivo `firestore.rules` publicadas en Firestore.

### 11.2 Variables de entorno requeridas

El archivo `.env.production` necesita estas variables:

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_BOOTSTRAP_ADMIN_EMAIL=
```

Los valores `VITE_` se incorporan al cliente en la compilación. No coloque claves de cuentas de servicio, tokens administrativos, contraseñas ni secretos privados en este archivo ni en el repositorio.

### 11.3 Publicar reglas desde Firebase Console

La versión vigente está en el archivo **`firestore.rules`** del repositorio. Para publicar manualmente los permisos de clientes, reservas, pagos, tareas, incidencias, gastos, impacto digital y seguridad de sesión:

1. Abra Firebase Console y entre a **Firestore Database → Reglas**.
2. Reemplace el contenido completo del editor por el contenido de `firestore.rules` incluido con esta versión.
3. Presione **Publicar** y espere la confirmación de Firebase.
4. Abra **Firestore Database → Índices** y compruebe que el índice de `carbonUsage` por `userId` ascendente y `recordedAt` descendente esté habilitado.

> No combine fragmentos de reglas anteriores: publique el archivo completo para preservar el principio de denegación por defecto y las reglas coordinadas de todas las colecciones.

1. Abra Firebase Console y seleccione `gestionpro-firebase`.
2. Vaya a **Firestore Database → Reglas**.
3. Abra el archivo local `firestore.rules` del repositorio.
4. Reemplace el contenido del editor por el contenido completo del archivo.
5. Revise que no haya errores de sintaxis.
6. Presione **Publicar**.
7. Recargue la pantalla de reglas y confirme que aparece una nueva versión en el historial.

También existe el comando técnico siguiente, que requiere una sesión autorizada de Firebase CLI:

```bash
pnpm deploy:firestore
```

### 11.4 Regla de recuperación de Firebase

Si una actualización rompe el acceso:

1. No borre colecciones ni usuarios como primer intento.
2. Abra el historial de versiones en **Firestore → Reglas**.
3. Compare la última regla funcional con `firestore.rules` del repositorio.
4. Publique la versión conocida como correcta.
5. Pruebe con una cuenta administradora y una cuenta Personal.

### 11.5 Administrador inicial

`VITE_BOOTSTRAP_ADMIN_EMAIL` permite crear el primer perfil administrador cuando ese correo inicia sesión por primera vez y aún no existe en `users`. Una vez creado el administrador, gestione al resto del equipo desde el panel Personal.

No cambie este correo sin revisar también la función `bootstrapAdmin()` en `firestore.rules`. Ambos valores deben permanecer alineados.

---

## 12. GitHub Pages: despliegue y recuperación

La publicación usa `.github/workflows/deploy-pages.yml`. Todo envío a la rama `main` ejecuta el flujo de GitHub Actions, instala dependencias, construye con `VITE_BASE_PATH=/Plataforma/` y publica `dist/public` en GitHub Pages.

### Publicar un cambio de código

```bash
git status
pnpm check
pnpm build
git add .
git commit -m "Describe el cambio"
git push origin main
```

Después de enviar el cambio:

1. Abra el repositorio en GitHub.
2. Entre a **Actions**.
3. Abra el flujo **Desplegar GestionPro en GitHub Pages**.
4. Espere que los trabajos `build` y `deploy` estén en verde.
5. Recargue `https://windsor-one.github.io/Plataforma/`.

### Si el sitio no se actualiza

| Síntoma | Acción recomendada |
| --- | --- |
| La acción falla en instalación | Confirme que `pnpm-lock.yaml` fue enviado y que `package.json` no está dañado. |
| Falla en compilación | Ejecute `pnpm check` y `pnpm build` localmente; corrija el primer error. |
| Carga una pantalla vacía | Revise la consola del navegador y confirme `VITE_BASE_PATH=/Plataforma/` en el flujo. |
| El enlace muestra versión antigua | Espere unos minutos, fuerce recarga del navegador y compruebe la última acción en GitHub. |
| La acción publica pero Firebase falla | Revise las variables de Firebase, dominios autorizados y reglas de Firestore. |

### Volver a una versión estable

La forma más segura es restaurar un commit o checkpoint que ya funcionaba. No utilice borrados masivos de Firestore para resolver un problema visual. Primero restaure código y reglas; luego compruebe los datos.

---

## 13. Mantenimiento técnico del código

### Estructura principal

| Ruta | Responsabilidad |
| --- | --- |
| `client/src/components/AuthGate.tsx` | Inicio de sesión, registro por invitación, recuperación y alta automática de perfil. |
| `client/src/components/Dashboard.tsx` | Navegación, formularios, paneles, permisos visuales y tablas. |
| `client/src/lib/firebase.ts` | Inicialización del cliente Firebase desde variables `VITE_`. |
| `client/src/lib/firestore.ts` | Lecturas, escrituras, códigos secuenciales, invitaciones y auditoría. |
| `client/src/lib/types.ts` | Contratos de datos de todos los módulos. |
| `client/src/lib/products.ts` | Catálogo base de productos y combinación con Firestore. |
| `client/src/lib/invoice.ts` | Generación de comprobantes PDF en el navegador. |
| `client/src/index.css` | Tokens visuales, barra lateral fija y reglas responsive. |
| `firestore.rules` | Seguridad real de Firestore. |
| `.github/workflows/deploy-pages.yml` | Construcción y publicación automática. |

### Comandos esenciales

```bash
# Instalar dependencias de acuerdo con el lockfile
pnpm install --frozen-lockfile

# Desarrollo local
pnpm dev

# Revisión de TypeScript
pnpm check

# Construcción de producción
pnpm build

# Formatear archivos
pnpm format

# Publicar reglas de Firestore con Firebase CLI autenticado
pnpm deploy:firestore
```

### Reglas para modificar código sin romper la plataforma

1. Lea `types.ts` antes de añadir campos a una reserva, pago o usuario.
2. Si agrega una colección, añada reglas explícitas en `firestore.rules` y publíquelas.
3. Si cambia la navegación, preserve la validación `isAdmin` para módulos administrativos.
4. Si agrega una escritura operativa, incorpore la trazabilidad en `activityLogs` dentro de `firestore.ts`.
5. Ejecute siempre `pnpm check` y `pnpm build` antes de enviar cambios a `main`.
6. No guarde imágenes grandes dentro de `client/public` o `client/src`; use almacenamiento web adecuado.

---

## 14. Solución de problemas

### No permite iniciar sesión

| Mensaje o síntoma | Revisión |
| --- | --- |
| Correo o contraseña incorrectos | Use el restablecimiento de contraseña con el correo registrado. |
| Cuenta deshabilitada | En **Personal**, cambie el estado a Activo. |
| Invitación no disponible | Revise que exista una invitación pendiente con el mismo correo. |
| `permission-denied` | Publique `firestore.rules` y confirme que el perfil existe en `users/{uid}`. |
| El correo no recibe enlace | Revise Spam, dominios autorizados y proveedor Correo/Contraseña en Firebase Authentication. |

### Los registros no guardan

1. Confirme que el usuario está activo.
2. Abra Firebase Console → Firestore → Reglas y confirme que la última versión está publicada.
3. Revise la consola del navegador para ver si aparece `permission-denied`.
4. Compruebe que el perfil del usuario tenga `status: "active"` y rol válido.
5. No cree documentos manuales de secuencia salvo que entienda el contador actual.

### No aparecen Notificaciones, Productos o Historial

Compruebe el rol. Productos se leen con cualquier perfil activo; Notificaciones se leen con cualquier perfil activo; Personal, Operación, Historial y Accesos requieren rol `admin`. Si el usuario debería tener acceso administrativo, cambie su rol desde Personal y vuelva a iniciar sesión.

### El panel izquierdo no se ve como se espera

En laptop la barra lateral está fijada a la altura de pantalla. En celular, se abre desde el control de menú y usa una cuadrícula compacta. Si una modificación rompe ese comportamiento, revise las reglas `.app-shell`, `.sidebar-panel` y los bloques `@media` de `client/src/index.css`.

---

## 15. Checklist de continuidad

### Semanal

- [ ] Revisar las reservas pendientes y pagos con saldo.
- [ ] Confirmar que las cuentas suspendidas correspondan a decisiones vigentes.
- [ ] Revisar Notificaciones para retirar avisos vencidos.
- [ ] Comprobar Historial y Accesos ante incidentes o dudas operativas.

### Antes de publicar cambios

- [ ] Crear un checkpoint o commit descriptivo.
- [ ] Ejecutar `pnpm check`.
- [ ] Ejecutar `pnpm build`.
- [ ] Revisar el flujo de GitHub Actions después del `push`.
- [ ] Si se modificaron reglas, publicar `firestore.rules` y probar con un perfil admin y uno Personal.

### Ante una emergencia

1. No elimine datos por impulso.
2. Identifique si el fallo es de código, Firebase Authentication, Firestore Rules o GitHub Pages.
3. Consulte primero este manual y el último commit/checkpoint estable.
4. Restaure código o reglas antes de alterar registros de producción.
5. Documente qué pasó, qué se cambió y qué cuenta se usó para probar.

---

## Contacto de continuidad

Mantenga actualizada esta tabla dentro de la organización, fuera del código fuente si contiene información personal.

| Responsabilidad | Titular | Correo / canal | Sustituto |
| --- | --- | --- | --- |
| Propiedad de Firebase |  |  |  |
| Propiedad de GitHub |  |  |  |
| Administración de Personal |  |  |  |
| Responsable de operación |  |  |  |
| Responsable de copias y cambios |  |  |  |

> **Última recomendación:** antes de cambiar roles, reglas o credenciales, haga un checkpoint/commit y describa el motivo. La trazabilidad humana complementa la trazabilidad técnica de la plataforma.

---

## Referencias

[1] [Sustainable Web Design Model v4: Estimating Digital Emissions](https://sustainablewebdesign.org/estimating-digital-emissions/)

[2] [Green Web Foundation: CO2.js Overview](https://developers.thegreenwebfoundation.org/co2js/overview/)
