# Auditoría lógica de SIGES

Esta auditoría contrasta el comportamiento real de la interfaz, las operaciones de `firestore.ts`, las reglas de Firestore y los procesos automáticos. El objetivo es detectar incoherencias que puedan impedir una operación válida, conceder permisos mayores a los previstos o dejar datos sin trazabilidad.

| Área | Flujo lógico esperado | Corrección aplicada | Estado |
|---|---|---|---|
| Directorio interno | El Personal activo consulta a los compañeros necesarios para guardias, asignaciones y correo. | La regla de `users` permite lectura al Personal activo; la gestión de identidad se mantiene en IT. | Publicado en Firestore |
| Gestión de Personal | IT administra invitaciones, roles, estados y accesos; Administración conserva la operación empresarial. | Las suscripciones, el menú y la renderización de Personal y Seguridad se limitaron a IT para coincidir con las reglas. | Corregido |
| Accesos e Historial | IT consulta accesos; Administración e IT consultan y pueden retirar historial según la política. | Se alinearon los paneles con el rol y se autorizó la eliminación administrativa de actividad. | Publicado en Firestore |
| Configuración de seguridad | Solo IT ajusta el cierre global por inactividad. | El control se mantiene exclusivamente dentro de Seguridad de IT; Administración ya no recibe una acción visible que las reglas rechacen. | Corregido |
| Recursos Humanos propio | El Personal actualiza solo sus datos de contacto y confirma políticas propias. | Las reglas comparan `request.resource.data` con `resource.data`; se habilitó la renovación controlada de confirmaciones de política. | Publicado en Firestore |
| Orden de registros | Correo, solicitudes, políticas y RR. HH. aparecen en orden reciente aunque no exista un índice compuesto. | Se normalizó el orden en cliente por marca de tiempo y se corrigió el campo de confirmaciones de política a `acknowledgedAt`. | Cubierto por pruebas |
| Incorporación invitada | El perfil y la aceptación de invitación se registran juntos o no se registra ninguno. | Se sustituyeron las escrituras separadas por un lote atómico de Firestore. | Corregido |
| Historial de acciones | Completitud de solicitudes y cierres manuales aparecen en la trazabilidad. | Se registra el cierre manual de sesión y la finalización de solicitudes asignadas. | Corregido |
| Historial y permisos administrativos | El respaldo del Historial conserva orden temporal real y Administración puede retirar movimientos conforme a la política. | Se sustituyó la ordenación por texto localizado por marcas de tiempo reales; se corrigió el filtro de seguridad y se alineó la eliminación con el permiso administrativo publicado. | Cubierto por pruebas |
| Reconocimientos | El Personal ve sus reconocimientos privados y los comunicados a toda la empresa sin duplicados. | Se combinan ambas consultas autorizadas y se eliminan duplicados por identificador antes de ordenar. | Cubierto por pruebas |
| Acceso e inactividad | Un fallo transitorio de bitácora no bloquea el acceso válido ni impide cerrar una sesión vencida. | El registro de inicio y cierre se intenta sin detener autenticación; el cierre por inactividad siempre ejecuta `signOut`. | Corregido |
| Finanzas multimoneda | SIGES no suma USD, EUR, MXN u otras monedas como si tuvieran el mismo valor. | Los agregados, flujo y resultado proyectado se calculan y se muestran por moneda, sin tipos de cambio inventados. | Cubierto por pruebas |
| Correo sin adjuntos | El correo funciona sin inicializar un servicio no disponible en el plan gratuito. | Firebase Storage se carga únicamente bajo demanda y el panel informa que los adjuntos están deshabilitados. | Cubierto por pruebas |

> La auditoría no modifica datos de clientes, Personal, pagos, RR. HH. ni historial. Cada corrección pasó pruebas, TypeScript y compilación; las correcciones de permisos fueron publicadas mediante Firebase Rules API. Una prueba de sesión real con cuentas autorizadas sigue siendo necesaria para validar los recorridos de negocio que dependen de datos de producción.
