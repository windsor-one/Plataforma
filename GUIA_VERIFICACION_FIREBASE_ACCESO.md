# Verificación de acceso de Heliot Media

## Estado confirmado

La cuenta administradora existe en **Firebase Authentication** y su perfil de Firestore coincide con el mismo UID. El proveedor **Correo electrónico/contraseña** está habilitado, `windsor-one.github.io` está autorizado y las reglas de Firestore ya fueron publicadas.

| Elemento | Valor confirmado |
| --- | --- |
| Correo administrador | `alexhrnndz32@gmail.com` |
| UID | `t8SJbl2mUYh56q0omdGvcOS6i9D2` |
| Perfil Firestore | `users/t8SJbl2mUYh56q0omdGvcOS6i9D2` |
| Rol / estado | `admin` / `active` |
| Proveedor | Correo electrónico/contraseña, habilitado |
| Dominio | `windsor-one.github.io`, autorizado |

> **No crees otro documento de usuario ni cambies el UID.** El perfil administrador correcto ya existe y está vinculado a la cuenta de Authentication.

## Regla de Firestore

El archivo adjunto `firestore.rules` contiene la política completa que debe estar publicada. Incluye acceso para empleados activos, control de administradores, invitaciones, historial, avisos generales y secuencias de códigos.

## Prueba que debes realizar

En [Heliot Media](https://windsor-one.github.io/Plataforma/), escribe el correo administrador. Si no recuerdas la contraseña, presiona **«¿Olvidaste tu contraseña? Restablécela por correo»**, abre el correo recibido y define una contraseña nueva. Después inicia sesión nuevamente con esa contraseña.

Si aparece un mensaje rojo, copia exactamente el texto incluido entre corchetes —por ejemplo, `[auth/invalid-credential]` o `[permission-denied]`—. La aplicación actualizada mostrará ese diagnóstico específico y permitirá corregir la causa sin adivinar.

## Qué revisar en Firebase si sigue sin acceder

| Mensaje que aparece | Acción concreta |
| --- | --- |
| `[auth/invalid-credential]` | Restablece la contraseña mediante el enlace de la plataforma. No crees una cuenta nueva. |
| `[auth/user-disabled]` | En **Authentication → Usuarios**, abre la cuenta y habilítala. |
| `[permission-denied]` | En **Firestore Database → Reglas**, publica exactamente el contenido de `firestore.rules`. |
| `No existe una invitación activa` | Confirma que el correo sea `alexhrnndz32@gmail.com`; el perfil administrador actual ya evita requerir una invitación. |
| `[auth/network-request-failed]` | Prueba sin VPN, extensiones de bloqueo o navegación privada. |

Tras acceder, crea primero un cliente de prueba. Debe aparecer con el código `CLI-00001` o el siguiente consecutivo; luego valida que el movimiento se muestre en **Historial** y abra su ficha al seleccionarlo.
