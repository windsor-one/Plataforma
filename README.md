# GestionPro

GestionPro es una plataforma web de gestión para **empleados autorizados**, con autenticación por correo y contraseña, módulos de clientes, reservas y pagos sincronizados en tiempo real, directorio de empleados administrado por roles, perfil personal y modo claro/oscuro.

> **Modelo de acceso:** el registro no es público. Una persona puede crear su cuenta únicamente cuando un administrador creó antes su invitación. Esta decisión evita que cuentas externas accedan a los datos operativos.

## Capacidades implementadas

| Área | Administrador | Personal activo |
| --- | --- | --- |
| Inicio de sesión y creación de cuenta invitada | Sí | Sí, con invitación previa |
| Perfil propio: nombre y contraseña | Sí | Sí |
| Editar correo o rol propio | No | No |
| Clientes, reservas y pagos | Crear, editar y eliminar | Crear, editar y eliminar |
| Panel de empleados | Crear invitación, editar rol/estado y retirar acceso | Sin acceso |
| Suspender empleado | Sí | No |
| Tema claro / oscuro | Sí | Sí |

## Arquitectura

| Capa | Tecnología | Responsabilidad |
| --- | --- | --- |
| Interfaz | React 19, TypeScript, Vite y Tailwind CSS | Panel responsive, formularios, tema y navegación |
| Identidad | Firebase Authentication | Correo y contraseña, sesión y actualización de contraseña |
| Datos en tiempo real | Cloud Firestore | Clientes, reservas, pagos, perfiles e invitaciones |
| Seguridad | Firestore Security Rules | Autoriza por usuario, rol y estado activo |
| Despliegue | GitHub Pages | Servir la aplicación estática sin coste |

Firebase Authentication permite implementar inicio de sesión y registro mediante correo y contraseña; Cloud Firestore evalúa las reglas de seguridad antes de cada solicitud de sus SDKs web [1] [2].

## Estructura de datos

| Colección | Documento | Campos clave |
| --- | --- | --- |
| `users` | UID de Firebase Auth | `email`, `displayName`, `role`, `status`, marcas de tiempo |
| `invitations` | correo normalizado | `email`, `displayName`, `role`, `status`, `invitedBy` |
| `customers` | ID automático | nombre, correo, teléfono, notas y `createdBy` |
| `reservations` | ID automático | cliente, fecha, hora, servicio, duración y estado |
| `payments` | ID automático | cliente, importe, moneda, método, fecha y estado |

## Preparación local

Instala Node.js 22 y `pnpm` 10. A continuación, clona el repositorio y ejecuta:

```bash
pnpm install
pnpm dev
```

Para ejecutar la aplicación con Firebase, crea un archivo local llamado `.env.local` en la raíz del proyecto. **No subas este archivo a GitHub.** Copia esta plantilla y reemplaza los valores por la configuración de tu aplicación web de Firebase:

```env
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abc123
```

El prefijo `VITE_` es necesario para que Vite exponga esas variables al código compilado. No agregues claves de cuentas de servicio, tokens administrativos ni secretos de servidor: esta plataforma usa exclusivamente las claves públicas de configuración del SDK web.

## Configuración exacta de Firebase

### 1. Crear el proyecto y la aplicación web

En [Firebase Console](https://console.firebase.google.com/), crea un proyecto. Dentro de **Project settings > General**, registra una aplicación web y copia los seis valores de configuración al archivo `.env.local` para desarrollo. Para este repositorio, la configuración pública de la aplicación web se entrega mediante `.env.production` durante la compilación de GitHub Pages. Después, en **Authentication > Sign-in method**, habilita **Email/Password**. Firebase requiere habilitar los proveedores de acceso antes de usar sus flujos de inicio de sesión [1].

### 2. Crear Cloud Firestore y publicar reglas

En **Build > Firestore Database**, crea la base de datos en modo de producción. Copia el contenido de `firestore.rules` en la pestaña **Rules** y pulsa **Publish**. Las reglas no son opcionales: constituyen la capa que evita que un usuario cambie el rol, lea módulos sin ser empleado activo o gestione el equipo sin ser administrador [2].

También puedes publicar las reglas desde la terminal:

```bash
npx firebase-tools login
npx firebase-tools use TU_PROJECT_ID
npx firebase-tools deploy --only firestore
```

El archivo `firebase.json` ya apunta a `firestore.rules`. Si optas por usar el CLI, conserva ese archivo bajo control de versiones para que las reglas se desplieguen junto al código. Firebase indica que el despliegue por CLI sobrescribe el conjunto de reglas mantenido en la consola [2].

### 3. Crear el primer administrador

Como el registro está protegido por invitación, debes crear **una sola vez** el primer perfil administrador:

1. Ve a **Authentication > Users > Add user**, crea el correo y la contraseña del administrador, y copia su **UID**.
2. Ve a **Firestore Database > Data > Start collection** y crea la colección `users`.
3. Crea un documento cuyo ID sea exactamente ese UID.
4. Añade los campos: `email` (string), `displayName` (string), `role` = `admin` (string), `status` = `active` (string), `createdAt` (timestamp) y `updatedAt` (timestamp).
5. Inicia sesión en GestionPro con ese correo. Desde **Empleados**, podrás autorizar al resto del equipo.

> **Importante:** un empleado suspendido no puede leer ni modificar los módulos operativos. Retirar un empleado elimina su perfil de Firestore y deja su cuenta de Firebase Auth sin permisos de acceso. Para borrar también el usuario de Firebase Authentication de forma irreversible se necesita un backend con Firebase Admin SDK o una Cloud Function; nunca debe hacerse desde el navegador.

### 4. Flujo de invitación de empleados

Desde el panel **Empleados**, el administrador registra el correo, el nombre y el rol. Esto crea una invitación pendiente en Firestore. El administrador debe compartir con la persona la URL de la plataforma y el correo autorizado; la persona selecciona **“¿Tienes una invitación? Regístrate”**, crea su contraseña y su perfil queda activo automáticamente.

Este repositorio implementa la autorización de invitación. El envío automático de correos no se incluye porque requiere un proveedor de correo y credenciales de servidor. Si lo necesitas, añade una Cloud Function con un proveedor transaccional, manteniendo sus secretos fuera del cliente.

## Despliegue gratuito en GitHub Pages

La aplicación ya está publicada en [https://windsor-one.github.io/Plataforma/](https://windsor-one.github.io/Plataforma/). El flujo `.github/workflows/deploy-pages.yml` compila React/Vite y publica automáticamente los archivos estáticos desde cada envío a `main`.

1. En **GitHub > Settings > Pages**, deja seleccionada la fuente **GitHub Actions**.
2. El archivo `.env.production` contiene exclusivamente la configuración pública del SDK web de Firebase; no contiene credenciales administrativas ni permite saltarse las reglas de Firestore.
3. En Firebase Console abre **Authentication > Settings > Authorized domains** y agrega exactamente `windsor-one.github.io`. No agregues la ruta `/Plataforma/`, solo el dominio.
4. Después de que Firestore esté creado y sus reglas estén publicadas, crea el primer administrador siguiendo la sección anterior e inicia sesión desde el enlace publicado.

El flujo inyecta `VITE_BASE_PATH` con el nombre del repositorio, por lo que las rutas y recursos se resuelven correctamente dentro de `/Plataforma/`. Las claves de configuración que empiezan por `VITE_` terminan deliberadamente en el cliente; las **reglas de Firestore**, y no la ocultación de esas claves, son el control de acceso principal.

## Validación antes de publicar

| Prueba | Resultado esperado |
| --- | --- |
| Registro con correo no invitado | Se crea el usuario de Auth, pero la plataforma deniega acceso y lo cierra |
| Registro con correo invitado | Se crea el perfil `users/{uid}` activo con el rol asignado |
| Personal abre `/` | No ve el módulo Empleados |
| Personal intenta escribir en `users` desde la consola | Firestore lo deniega por reglas |
| Admin suspende un empleado | En la próxima validación de sesión ese empleado no accede a datos |
| Cambio de tema | Persiste localmente y aplica a todos los módulos |

## Referencias

[1]: https://firebase.google.com/docs/auth "Firebase Authentication — documentación oficial"

[2]: https://firebase.google.com/docs/firestore/security/get-started "Cloud Firestore Security Rules — documentación oficial"
