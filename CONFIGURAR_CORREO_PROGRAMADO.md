# Configuración gratuita del correo interno programado

SIGES entrega mensajes programados mediante una tarea de GitHub Actions que se ejecuta cada cinco minutos. La tarea no envía correos externos: convierte los mensajes internos cuyo horario ya venció de `scheduled` a `sent`, de modo que aparecen en la bandeja de sus destinatarios. El horario es aproximado porque GitHub puede retrasar ejecuciones programadas.

## Secreto requerido

En Firebase Console, abra **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada**. Descargue el JSON y consérvelo de forma privada. Después, en GitHub abra **windsor-one/Plataforma → Settings → Secrets and variables → Actions → New repository secret** y cree el siguiente secreto:

| Nombre | Valor |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | El contenido completo, sin modificar, del archivo JSON de la cuenta de servicio de Firebase. |

No copie este JSON a archivos del repositorio ni lo comparta por mensajería. GitHub lo entrega únicamente al trabajo programado durante su ejecución.

## Publicar las reglas

Antes de usar adjuntos, publique las reglas de Firestore y Firebase Storage incluidas en el proyecto. Desde un entorno con sesión autorizada de Firebase ejecute:

```bash
pnpm deploy:firebase-rules
```

El comando incorpora el índice de correos programados, la colección `internalMessages` y las rutas privadas `internalMessages/{messageId}/{fileName}` de Storage.

## Verificación

Tras añadir el secreto y subir este código a `main`, abra **Actions → Procesar correo interno programado → Run workflow** para una ejecución manual de prueba. Un mensaje con estado `scheduled` y fecha pasada debe pasar a `sent`; su bandeja interna se actualizará en tiempo real.
