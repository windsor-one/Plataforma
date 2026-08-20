# Informe final de reparación y mantenimiento de SIGES

**Sistema:** SIGES — Sistema Integral de Gestión Estratégica  
**Repositorio:** [windsor-one/Plataforma](https://github.com/windsor-one/Plataforma) [1]  
**Producción:** [https://windsor-one.github.io/Plataforma/](https://windsor-one.github.io/Plataforma/) [2]  
**Fecha de verificación:** 19 de agosto de 2026, zona horaria del usuario.  
**Autor:** Manus AI

## Resultado ejecutivo

La plataforma quedó publicada en GitHub Pages y la pantalla pública carga correctamente como **SIGES**, sin el error inmediato de runtime que mostraba `Cannot read properties of undefined (reading 'map')`. La solución no agrega servicios de pago: continúa utilizando Firebase gratuito y GitHub Pages.

La reparación acumulada cubre integridad de cuotas y pagos, reportes con datos reales, fechas locales, normalización de documentos históricos, permisos y reglas Firestore, correo interno sin adjuntos, marca SIGES, organización de Recursos Humanos, guardias de tres días, buscador global y configuración de workflows.

## Cambios implementados en esta continuación

| Área | Implementación | Resultado |
|---|---|---|
| Solicitudes y permisos | Se sustituyó el formulario libre por un flujo guiado de persona, módulo, submódulo, registro real, campos autorizados, acciones y fecha límite. | Las solicitudes pueden especificar, por ejemplo, Expedientes, Asistencia, Organización, Contratos, Clientes, Pagos, Gastos, Correo y otros recursos concretos. |
| Catálogo dependiente | Se creó `client/src/lib/requestTargets.ts` con definiciones de submódulos, colecciones y campos disponibles. | Los registros se cargan desde las colecciones que ya están conectadas al usuario y respetan la disponibilidad por rol. |
| Persistencia | `submodule`, `targetCollection` y los campos seleccionados se guardan en `updateRequests` y en el permiso temporal; también se incluyen en la notificación interna. | El permiso queda trazable y entendible para quien lo recibe. |
| Compatibilidad | `normalizeUpdateRequest` ahora acepta todos los módulos declarados por SIGES y conserva solicitudes históricas sin romperlas. | Se elimina una fuente de estados inválidos y errores de interfaz. |
| Editar varios | El botón activa un modo visible, muestra una confirmación contextual, limpia selecciones al cambiar de módulo y solo aparece donde existen acciones masivas reales. | Clientes, Pagos y Personal administrado por IT tienen operaciones masivas funcionales; RR. HH. ya no muestra un botón sin acciones conectadas. |
| Correo interno | Se verificó el flujo de envío, borradores y programados; el sistema continúa sin adjuntos para evitar el bloqueo del plan gratuito. | Se mantienen papelera, restauración y eliminación definitiva por buzón, con reglas Firestore para `trashedByIds` y `deletedByIds`. |
| Marca y CSS | Se eliminaron referencias visibles residuales de Heliot/GestionPro en la interfaz y se consolidó la variable de animación como `--ease-siges`. | La experiencia publicada muestra SIGES de forma consistente. |

## Reparación acumulada ya publicada

Los commits anteriores incorporan el motor de cuotas múltiples, estado pendiente/liquidado/sobrepago, moneda bloqueada por reserva, comprobantes con información real, Centro de Informes, planilla, fechas locales, organigrama jerárquico, guardia de tres días, buscador por registro, normalización de datos históricos, suscripciones sin `orderBy` excluyente, reglas Firestore endurecidas y jobs de vencimientos.

Los commits relevantes publicados son:

| Commit | Descripción |
|---|---|
| `9e1d33b` | Reparar integridad financiera y flujos de SIGES. |
| `682ef6c` | Consolidar marca SIGES en la interfaz. |
| `1e38659` | Hacer solicitudes y edición masiva específicas. |
| `f75b185` | Conservar referencias de solicitudes manuales. |

## Validaciones ejecutadas

Se ejecutaron correctamente `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm t`, `pnpm build`, `node --check scripts/close-expired-update-requests.mjs`, `node --check scripts/process-hr-expiry-alerts.mjs` y `git diff --check`.

La suite quedó en **17 archivos y 47 pruebas aprobadas**. El build de Vite terminó correctamente. El aviso de chunks grandes es una advertencia de optimización, no un fallo de compilación ni de despliegue.

El workflow de GitHub Pages del commit final `f75b185` terminó en **success** en sus jobs `build` y `deploy` [3]. La publicación de las reglas Firestore del commit `9e1d33b` también terminó en **success** [4]. Los commits posteriores no modificaron `firestore.rules`, por lo que no requerían una nueva publicación de reglas.

La URL pública fue recargada después del último despliegue y mostró **SIGES — Acceso seguro** sin error de runtime inmediato [2].

## Alcance de seguridad y precisión

Los permisos temporales siguen estando limitados por usuario, módulo, alcance, registro, acción y vencimiento en Firestore. La nueva información de submódulo, colección y campos queda almacenada para trazabilidad y para guiar el flujo de la interfaz. La validación de reglas Firestore existente aplica de forma efectiva módulo, alcance, registro, acción, estado activo y fecha de expiración; la restricción campo-por-campo todavía no se ejecuta como `diff().affectedKeys().hasOnly(...)` en todas las colecciones, por lo que no debe presentarse como una capacidad ya garantizada por las reglas.

## Pendientes explícitos de auditoría

| Identificador | Estado |
|---|---|
| SIGES-08 — vulnerabilidades de dependencias | Pendiente de triage manual y actualización controlada. No se aplicó una actualización automática riesgosa. |
| SIGES-20 — pruebas E2E autenticadas con Firebase Emulator | Pendiente; las pruebas actuales son unitarias y de integración lógica. |
| SIGES-16 — planificación de guardias de cuatro semanas | La vista de tres días siguientes está implementada; la planificación de cuatro semanas continúa como vista principal. |
| Seguridad campo-por-campo en reglas | La solicitud ya registra campos específicos, pero falta aplicar esa lista como restricción de `affectedKeys` en cada colección compatible. |

Estos pendientes no impiden la carga, compilación ni publicación de la plataforma, pero requieren una siguiente iteración técnica si se desea una auditoría de seguridad y pruebas end-to-end más profunda.

## Referencias

[1]: https://github.com/windsor-one/Plataforma "Repositorio oficial de SIGES"

[2]: https://windsor-one.github.io/Plataforma/ "Aplicación SIGES publicada en GitHub Pages"

[3]: https://github.com/windsor-one/Plataforma/actions/runs/32316591358 "Workflow de GitHub Pages del commit f75b185"

[4]: https://github.com/windsor-one/Plataforma/actions/runs/32315539928 "Workflow de publicación de reglas Firestore del commit 9e1d33b"
