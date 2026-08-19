# Reporte de auditoría lógica de SIGES

**Fecha de cierre técnico:** 19 de agosto de 2026  
**Alcance:** SIGES para Heliot Media, publicado en [GitHub Pages](https://windsor-one.github.io/Plataforma/).  
**Criterio de auditoría:** Se revisó la cadena completa de cada flujo crítico: interfaz, rol visible, operación de Firestore, reglas de seguridad, trazabilidad, lectura posterior y automatizaciones programadas. No se eliminó ni se alteró información de producción durante la auditoría.

## Resumen ejecutivo

La auditoría detectó y corrigió varias incoherencias lógicas que podían provocar mensajes de “actualiza las reglas de Firebase”, impedir operaciones válidas de Recursos Humanos, mezclar importes de diferentes monedas o dejar flujos sin trazabilidad. Las correcciones fueron compiladas, probadas y publicadas. Las reglas actuales de Firestore también fueron publicadas mediante la API oficial, sin activar Firebase Storage ni servicios de pago.[1] [2]

| Resultado | Estado |
|---|---|
| Pruebas automatizadas | **9 pruebas aprobadas** en 5 archivos de prueba |
| Validación TypeScript | **Aprobada** sin errores |
| Compilación de producción | **Aprobada** |
| Reglas de Firestore | **Publicadas y verificadas** |
| Despliegue público | **Publicado correctamente** en GitHub Pages |
| Datos existentes | **Conservados**; no se aplicaron migraciones destructivas |
| Firebase Storage | **Deshabilitado deliberadamente** para mantener el plan gratuito |

> La aplicación pública carga correctamente la pantalla de acceso de SIGES con inicio de sesión, recuperación de contraseña y registro por invitación. La comprobación está documentada en la evidencia de producción.[1]

## Metodología aplicada

La revisión no se limitó a la compilación. Se construyó una matriz de escenarios que relaciona cada módulo con sus reglas de negocio, los roles autorizados, las escrituras requeridas y la lectura posterior esperada. Se revisaron las colecciones, las reglas de Firestore, las suscripciones en tiempo real, los flujos de autenticación, la asistencia, las automatizaciones, el correo interno, el historial y las finanzas.[3] [4]

| Capa revisada | Qué se comprobó |
|---|---|
| Interfaz | Que los botones y paneles solo aparezcan para roles capaces de ejecutar la acción. |
| Firestore | Que cada consulta y escritura coincida con una regla publicada. |
| Roles | Separación entre Departamento de IT, Administración y Personal. |
| Integridad | Que invitaciones, registros, códigos, fechas y estados no dejen datos parciales. |
| Trazabilidad | Que las operaciones relevantes conserven actor, fecha y descripción. |
| Automatización | Que correo programado, guardias, vencimientos y alertas respeten su estado activo o pausado. |
| Producción | Que GitHub Pages y las reglas de Firebase se publiquen correctamente. |

## Hallazgos y correcciones aplicadas

| Área | Hallazgo lógico | Corrección aplicada | Estado |
|---|---|---|---|
| Recursos Humanos | Actualizaciones propias y confirmaciones de políticas podían ser rechazadas por comparar datos contra una referencia incorrecta. | Se corrigieron las comparaciones de `request.resource.data` contra `resource.data` y la renovación controlada de políticas. | Publicado en Firestore |
| Directorio interno | El Personal necesitaba consultar perfiles mínimos para correo, guardias y asignaciones, pero la consulta podía quedar bloqueada. | Se autorizó la lectura del directorio para Personal activo sin conceder gestión de roles, estados o invitaciones. | Publicado en Firestore |
| Roles y paneles | Algunos controles visibles de Administración no coincidían con acciones reservadas a IT. | Se alinearon navegación, suscripciones y controles: IT conserva identidad y seguridad; Administración conserva la operación empresarial. | Corregido |
| Alta por invitación | El perfil del empleado y la aceptación de la invitación podían quedar desincronizados si la segunda escritura fallaba. | Se sustituyó por un lote atómico: ambas operaciones se completan juntas o ninguna se aplica. | Corregido |
| Alta inicial del propietario | La cuenta bootstrap podía no leer su propio perfil inexistente y no completar el alta automática. | Se permite exclusivamente a la cuenta propietaria leer su propio perfil durante el bootstrap inicial. | Publicado en Firestore |
| Guardia semanal | Las reasignaciones podían ser rechazadas mientras las reglas no estaban publicadas; también se corrigió la semana objetivo de la rotación. | Se publicaron reglas y se verificó la automatización idempotente de guardia. | Publicado y automatizado |
| Solicitudes de actualización | La persona podía completar una solicitud, pero ese cierre no quedaba explícitamente en Historial. | Se añadió una entrada auditada al completar una solicitud asignada. | Corregido |
| Correo interno | Firebase Storage se iniciaba aunque los adjuntos no están disponibles en Spark, generando errores de consola. | Storage se carga solo bajo demanda; el correo funciona sin adjuntos y muestra una explicación clara. | Corregido |
| Historial | El respaldo de historial se ordenaba con fechas convertidas a texto, lo que podía alterar el orden real. | Se usa una utilidad común que ordena por marcas de tiempo reales. | Cubierto por pruebas |
| Historial y permisos | El filtro de seguridad no coincidía con la entidad auditada y Administración no veía el control de eliminación aunque las reglas lo permitían. | Se corrigió el filtro y se alineó el control con el permiso administrativo. | Corregido |
| Sesiones | Un fallo temporal al guardar la bitácora podía bloquear un acceso válido o impedir un cierre por inactividad. | El registro de acceso es tolerante a fallos; el cierre automático siempre ejecuta el cierre de sesión. | Corregido |
| Reconocimientos | El Personal podía no ver reconocimientos públicos de empresa o verlos duplicados. | Se fusionan consultas propias y de empresa, se eliminan duplicados y se conserva el orden temporal. | Cubierto por pruebas |
| Finanzas | Algunos indicadores podían sumar USD, EUR, MXN u otras monedas como si fueran equivalentes. | Finanzas y Resumen agrupan importes por moneda; los gráficos comparan número de cobros, no montos incompatibles. | Cubierto por pruebas |
| Adjuntos | Firebase Storage exige facturación y no es compatible con el objetivo de operación gratuita. | Los adjuntos se mantienen deshabilitados; correo, borradores, programación, pausa y eliminación de mensajes siguen disponibles. | Decisión operativa |

## Validaciones técnicas ejecutadas

Las correcciones se validaron tras cada bloque estable mediante la secuencia siguiente:

```bash
pnpm test && pnpm check && pnpm build
```

| Validación | Resultado |
|---|---|
| Pruebas de cierre de sesión | Aprobadas |
| Pruebas de cálculos financieros por moneda | Aprobadas |
| Pruebas de Firebase sin Storage obligatorio | Aprobadas |
| Pruebas de orden de correo interno | Aprobadas |
| Pruebas de orden y fusión de registros | Aprobadas |
| TypeScript | Aprobado |
| Build Vite + servidor | Aprobado |
| Publicación de Firestore Rules API | Aprobada en la ejecución `32218890190` |
| Último despliegue GitHub Pages | Aprobado en la ejecución `32219582571` |

Las automatizaciones gratuitas —correo programado, rotación de guardia, cierre de solicitudes vencidas y alertas de RR. HH.— también se ejecutaron correctamente en GitHub Actions.[1]

## Estado actual por rol

| Capacidad | Departamento de IT | Administración | Personal |
|---|---:|---:|---:|
| Gestionar identidad, invitaciones, estados y roles | Sí | No | No |
| Configurar seguridad global e inactividad | Sí | No | No |
| Gestionar operación, RR. HH., automatizaciones y finanzas | Sí | Sí | No |
| Crear y gestionar clientes, reservas y pagos | Sí | Sí | Sí, dentro de operación autorizada |
| Actualizar datos propios | Sí | Sí | Sí, con campos restringidos |
| Reportar incidencias | Sí | Sí | Sí |
| Actualizar estado de tareas asignadas | Sí | Sí | Sí, solo propias |
| Consultar historial general | Sí | Sí | No |
| Consultar seguridad y accesos | Sí | No | No |

## Límites conocidos y pruebas pendientes con sesión real

La revisión técnica y la publicación están terminadas. Sin embargo, por seguridad no se utilizaron ni solicitaron contraseñas de usuarios reales. Por ello, los siguientes recorridos requieren que un integrante autorizado los ejecute desde la página pública con sus propias credenciales:

| Recorrido pendiente | Qué se debe confirmar |
|---|---|
| Inicio de sesión | Cuenta activa entra; cuenta suspendida queda fuera; errores se muestran con mensajes claros. |
| Invitación | Un empleado invitado se registra, aparece en `users` y la invitación queda aceptada. |
| Pago y reserva | Registro, código secuencial, saldo, auditoría y actualización en tiempo real. |
| Perfil y contraseña | Cambio de nombre, recuperación por correo y cierre automático por inactividad. |
| Factura PDF | Descarga y datos correctos de un pago real. |
| Historial | Visualización de la operación y filtros correctos para Administración/IT. |
| RR. HH. | Creación o edición de expedientes, marcaciones, guardia y solicitudes de actualización. |

Estas validaciones no implican configuración adicional ni pagos. Los adjuntos no se deben probar mientras Firebase Storage permanezca deshabilitado.

## Conclusión

SIGES quedó **corregido, compilado, publicado y con sus reglas de Firestore activas**. La auditoría eliminó los principales desajustes entre interfaz, roles, reglas y persistencia, y añadió cobertura para los puntos lógicos más sensibles: Recursos Humanos, invitaciones, sesiones, historial, correo, guardias, solicitudes y finanzas multimoneda.

La condición pendiente no es una corrección de código: es la validación final de recorridos con cuentas y datos reales autorizados. Esta separación protege las credenciales y evita alterar la información existente durante la auditoría.

## Referencias

[1]: ./VALIDACION_PUBLICA.md "Evidencia de producción, reglas y despliegues de SIGES"
[2]: ./firestore.rules "Reglas actuales de acceso de Cloud Firestore"
[3]: ./AUDITORIA_LOGICA_SIGES.md "Matriz de hallazgos y correcciones lógicas"
[4]: ./MATRIZ_PRUEBAS_SIGES.md "Matriz de pruebas de SIGES"
