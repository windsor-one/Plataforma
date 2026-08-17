# Estado de activación de Firebase

El usuario autorizó crear el proyecto gratuito `gestionpro-firebase` desde su propia sesión de Google. En la consola de Firebase se ingresó ese nombre; el siguiente paso es continuar el asistente manteniendo Analytics desactivado y sin vincular una cuenta de facturación.

El asistente mostró que quedan dos proyectos disponibles dentro del límite actual de la cuenta. Se continuó sin usar el enlace de aumento de cuota y ahora se presenta una pantalla opcional de asistencia de IA; no se habilitará ninguna función de IA ni plan de pago.

La opción “Habilitar Gemini en Firebase” estaba activada por defecto y se desactivó. El siguiente paso del asistente puede continuar con esta opción apagada.

El asistente ofrece Google Analytics activado por defecto. Se desactivará porque GestionPro no lo necesita para autenticación, Firestore ni GitHub Pages, manteniendo la configuración mínima solicitada.

Google Analytics fue desactivado y se pulsó “Crear proyecto”. La solicitud de creación fue enviada sin Gemini, sin Analytics y sin cuenta de facturación; se debe verificar que la consola abrió el proyecto nuevo.

La consola confirmó que el proyecto `gestionpro-firebase` está listo. Se continuará hacia su panel para registrar la aplicación web, habilitar Authentication y crear Firestore.

El proyecto abrió correctamente en Firebase Console y muestra “Plan Spark”, confirmando la ruta sin coste. El siguiente paso es seleccionar “Agregar app” y registrar la aplicación web de GestionPro.

Se eligió la plataforma web y se indicó el alias `GestionPro Web`. La casilla de Firebase Hosting permanece desmarcada porque el sitio se publica gratuitamente en GitHub Pages. El botón “Registrar app” está listo para finalizar el registro.

El registro finalizó correctamente: el panel del proyecto muestra “1 app” y continúa en el plan Spark. Falta abrir esa aplicación para copiar la configuración web de Firebase y habilitar Authentication y Cloud Firestore.

La configuración general confirma el ID del proyecto `gestionpro-firebase` y que la aplicación web `GestionPro Web` fue creada. Sus valores públicos de SDK se buscarán en la misma página para configurar las variables `VITE_FIREBASE_*`.

La configuración del SDK se incorporó a la compilación de GitHub Pages. Firebase Authentication está disponible y el proveedor “Correo electrónico/contraseña” figura como **Habilitada**. No se requieren cambios de plan ni configuraciones adicionales para que GestionPro permita iniciar sesión por correo y contraseña.

La aplicación publicada carga ahora la pantalla de inicio de sesión, lo que confirma que reconoce la configuración Firebase. La consola de Firestore no terminó de cargar de forma fiable en el navegador disponible; una consulta administrativa sin credenciales OAuth confirmó que esta verificación exige permisos de propietario y no realizó cambios.
