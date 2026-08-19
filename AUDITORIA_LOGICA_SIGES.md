# Auditoría lógica de SIGES

Esta auditoría contrasta el comportamiento real de la interfaz, las operaciones de `firestore.ts`, las reglas de Firestore y los procesos automáticos. El objetivo es detectar incoherencias que puedan impedir una operación válida, conceder permisos mayores a los previstos o dejar datos sin trazabilidad.

| Área | Flujo lógico esperado | Hallazgo inicial | Riesgo | Prioridad |
|---|---|---|---|---|
| Directorio interno | El Personal activo debe poder consultar a los compañeros necesarios para la guardia y la operación interna. | La interfaz consulta `users` para toda sesión, pero las reglas solo permiten listar a Administración/IT. | El Personal recibe un error de sincronización y una guardia no puede seleccionar integrantes. | Crítica |
| Gestión de Personal | Administración e IT usan el mismo panel operativo; IT conserva las facultades de seguridad exclusivas. | La interfaz permite a Administración invitar y gestionar Personal, mientras las reglas reservan invitaciones y cambios de perfiles a IT. | Operaciones visibles fallan con un aviso genérico de Firebase. | Crítica |
| Accesos e Historial | Administración e IT pueden consultar accesos; ambos pueden gestionar el historial según la política solicitada. | La interfaz usa estos paneles para ambos roles, pero algunas reglas son exclusivas de IT. | Errores de sincronización y acciones administrativas bloqueadas. | Alta |
| Configuración de seguridad | Solo IT ajusta el cierre global por inactividad; Administración puede consultarlo. | La interfaz muestra el formulario de edición a Administración aunque las reglas solo permiten escribir a IT. | Error de permisos y confusión operativa. | Alta |
| Recursos Humanos propio | El Personal puede actualizar exclusivamente sus datos de contacto. | Las comparaciones de cambios utilizaban el documento completo en lugar de `resource.data`. | Las actualizaciones podían ser rechazadas por reglas válidas pero mal evaluadas. | Crítica |
| Políticas de RR. HH. | El Personal puede confirmar una política activa, incluso tras una nueva versión. | Un reconocimiento existente no podía actualizarse para registrar una versión posterior. | La aceptación de políticas podía quedar bloqueada. | Media |
| Correo sin adjuntos | El correo opera sin inicializar un servicio no disponible en el plan gratuito. | Firebase Storage se inicializaba al cargar el cliente aunque los adjuntos estaban deshabilitados. | Error de consola y posible interrupción en entornos sin Storage. | Alta |

> La auditoría no modifica datos de clientes, Personal, pagos, RR. HH. ni historial. Cada corrección debe pasar pruebas, compilación y publicación explícita de reglas antes de considerarse resuelta.
