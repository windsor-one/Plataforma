# Matriz de pruebas lógicas de SIGES

Esta matriz convierte los requisitos operativos de SIGES en verificaciones repetibles. Cada caso debe comprobar el recorrido completo: acción en interfaz, validación del rol, escritura o consulta de Firestore, auditoría asociada y lectura posterior. No se usarán datos ficticios en producción; las pruebas de sesión real se ejecutarán solo con cuentas y datos autorizados.

| Dominio | Escenario crítico | Resultado esperado | Nivel de prueba | Estado |
|---|---|---|---|---|
| Acceso | Inicio de sesión de cuenta activa, suspendida e invitada | Solo la cuenta activa con perfil válido entra; la suspendida queda fuera y la invitada crea su perfil autorizado. | Integración y sesión real | Pendiente de sesión autorizada |
| Roles | Personal, Administración e IT abren las secciones permitidas | La interfaz y Firestore coinciden: IT controla identidad y seguridad; Administración opera RR. HH. y operación; Personal solo realiza acciones propias. | Reglas e integración | En auditoría |
| Clientes, reservas y pagos | Crear, editar, eliminar, numerar y auditar una operación | El registro, su código secuencial, las referencias y el historial quedan consistentes; el fallo de auditoría no pierde la operación principal. | Unidad e integración | En auditoría |
| Facturación | Pago con anticipo, parcial y saldo | El saldo de la reserva se calcula de forma coherente y el comprobante PDF refleja el importe correcto. | Escenario de negocio | Pendiente de sesión autorizada |
| RR. HH. | Crear expediente, estructura, contrato, documento, horario, asistencia y ausencia | Administración/IT puede gestionar registros; Personal solo actualiza su contacto, marca su asistencia y solicita ausencia. | Reglas e integración | Corrección en curso |
| Guardia semanal | Rotación, reasignación y marcación colectiva | Solo la persona de guardia registra asistencia colectiva; Administración/IT reasigna y la automatización crea la semana siguiente. | Integración y automatización | Validado por automatización; falta sesión real |
| Solicitudes | Solicitar actualización, completar antes de vencimiento y cerrar vencida | Administración/IT asigna; la persona objetivo completa solo lo suyo; el cierre programado respeta la fecha. | Integración y automatización | Validado por automatización; falta sesión real |
| Correo interno | Enviar, programar, pausar, editar, leer y eliminar | La bandeja respeta participantes y estado; el proceso programado entrega vencidos. Los adjuntos permanecen deshabilitados sin bloquear el correo. | Unidad e integración | En auditoría |
| Automatizaciones | Crear, pausar, reanudar, eliminar y ejecutar reglas núcleo | Solo Administración/IT administra reglas; las tareas horarias respetan su estado activo o pausado. | Integración y automatización | Validado por automatización |
| Historial y accesos | Registrar creación, cambio, eliminación y acceso | El actor, fecha, entidad y detalle quedan auditados; Administración/IT consulta según la política de permisos. | Reglas e integración | En auditoría |
| Impacto digital | Crear y cerrar una sesión propia | Cada usuario registra solo sus métricas; Administración/IT consulta el consolidado sin alterar el historial. | Reglas e integración | En auditoría |

> Un caso se considera superado únicamente cuando la lógica, las reglas, la interfaz y la lectura posterior coinciden. Una compilación exitosa por sí sola no sustituye una prueba de negocio ni una sesión real autorizada.
