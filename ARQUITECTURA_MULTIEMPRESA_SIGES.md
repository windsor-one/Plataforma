# Arquitectura multiempresa para SIGES

## Objetivo

Transformar SIGES de una plataforma orientada inicialmente a Heliot Media en una plataforma centralizada de múltiples empresas. El Departamento de IT central administra la infraestructura y brinda soporte transversal; cada empresa conserva un ecosistema aislado con sus propios administradores, Personal y datos.

> El aislamiento debe aplicarse en Firestore y en las operaciones de servidor. Ocultar datos desde React no es una barrera de seguridad suficiente.

## Jerarquía propuesta

| Nivel | Identificador | Alcance |
|---|---|---|
| Plataforma | `platform` | Propiedad técnica de SIGES, políticas globales y auditoría del Departamento de IT central. |
| Empresa | `organizationId` | Ecosistema aislado: marca, usuarios, catálogo, operación, RR. HH. y métricas propias. |
| Administrador de empresa | Membresía `company_admin` | Opera una sola empresa y nunca puede consultar otra. |
| Personal | Membresía `staff` | Trabaja únicamente dentro de la empresa asignada. |

El rol actual `it` se divide conceptualmente en dos alcances: `platform_it`, reservado a ustedes, y el rol operativo por empresa. Un miembro puede pertenecer a una empresa; un integrante de IT central puede tener acceso de soporte a varias, siempre con una entrada de auditoría.

## Modelo de datos recomendado

La opción más segura es anidar los datos operativos dentro de cada empresa:

```text
organizations/{organizationId}
  ├── memberships/{userId}
  ├── customers/{customerId}
  ├── reservations/{reservationId}
  ├── payments/{paymentId}
  ├── products/{productId}
  ├── tasks/{taskId}
  ├── internalMessages/{messageId}
  ├── hrProfiles/{employeeId}
  ├── attendanceGuards/{weekKey}
  ├── updateRequests/{requestId}
  ├── automations/{automationId}
  └── activityLogs/{activityId}

platformUsers/{userId}
platformAudit/{auditId}
```

Cada empresa mantiene su propia configuración, secuencias de códigos, catálogo, políticas de asistencia y automatizaciones. Una secuencia `CLI-00001` puede existir en dos empresas distintas porque el contexto de empresa es diferente; dentro de la misma empresa permanece única.

## Reglas de acceso

| Operación | Personal | Administrador de empresa | IT central |
|---|---:|---:|---:|
| Leer datos de su empresa | Sí, según módulo | Sí | Sí, con auditoría de soporte |
| Crear/editar operación | Según permisos | Sí | Sí |
| Gestionar Personal | No | Sí, dentro de su empresa | Sí |
| Ver otra empresa | No | No | Sí, con registro técnico |
| Crear/suspender empresas | No | No | Sí |
| Cambiar reglas globales | No | No | Sí |

Las reglas de Firestore deberán obtener la membresía de la ruta `organizations/{organizationId}/memberships/{request.auth.uid}` antes de permitir cualquier lectura o escritura. Un usuario no debe poder elegir libremente el `organizationId` desde el navegador.

## Panel de IT central

El Departamento de IT tendría un panel adicional con estas capacidades:

| Área | Función |
|---|---|
| Empresas | Crear, activar, suspender, archivar y personalizar ecosistemas. |
| Soporte | Entrar temporalmente a una empresa con motivo obligatorio y auditoría. |
| Seguridad | Revisar usuarios, accesos, políticas globales, estados de servicio y reglas. |
| Uso | Consultar métricas agregadas por empresa sin mezclar detalles sensibles innecesarios. |
| Facturación y plan | Registrar el paquete contratado por cada empresa, si se comercializa. |

## Migración segura de Heliot Media

1. Crear la empresa inicial `heliot-media` con su configuración y membresías actuales.
2. Añadir `organizationId: heliot-media` a cada registro existente mediante una migración reversible y auditada.
3. Migrar colecciones a rutas anidadas por empresa o mantener temporalmente colecciones planas con `organizationId` y reglas estrictas.
4. Reescribir las reglas de Firestore para validar membresía antes de publicar la aplicación multiempresa.
5. Verificar con tres cuentas de prueba: IT central, administrador de Heliot y Personal de Heliot.
6. Crear una empresa de prueba independiente y comprobar que no puede leer ni inferir información de Heliot.

## Recomendación de lanzamiento

No convertir la instancia actual directamente en producción sin una copia de seguridad y una fase de migración. Primero debe estabilizarse Heliot Media, publicar las reglas pendientes y probar los módulos actuales. Después se puede crear una rama de migración multiempresa, validar el aislamiento con datos de prueba y publicar cuando todas las reglas estén verificadas.
