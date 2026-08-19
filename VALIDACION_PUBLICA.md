# Validación de producción de SIGES

La comprobación se realizó el **19 de agosto de 2026** sobre la URL pública [`https://windsor-one.github.io/Plataforma/`](https://windsor-one.github.io/Plataforma/). SIGES carga la pantalla de acceso seguro con correo, contraseña, recuperación por correo y registro mediante invitación. Por tanto, la aplicación publicada incluye su configuración pública de Firebase y no muestra la pantalla de configuración local pendiente.

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Compilación de producción | Superada | Pruebas, TypeScript y compilación ejecutados localmente antes del despliegue. |
| Publicación de reglas de Firestore | Correcta | La ejecución de GitHub Actions `32218890190` concluyó correctamente con la API oficial de Firebase Rules, incluyendo el alta inicial segura del propietario. |
| Automatizaciones programadas | Correctas | Correo programado, guardia semanal, solicitudes vencidas y alertas de RR. HH. fueron validados en la ejecución `32215961282`. |
| Despliegue de GitHub Pages | Correcto | La ejecución `32219484038` publicó la corrección multimoneda del Resumen sin errores. |

> Las reglas actuales de **Firestore** están activas en producción, incluidos los permisos de guardias semanales, solicitudes de actualización y automatizaciones. La aplicación continúa sin adjuntos porque **Firebase Storage** exige facturación en este proyecto y se mantiene deshabilitado para respetar el plan gratuito.

La única verificación que requiere una sesión real de personal es recorrer inicio de sesión, pago, invitación, perfil, generación de PDF e historial desde la página pública. No se realizaron pruebas con contraseñas de usuarios para preservar sus credenciales.

## Enlaces de evidencia

[1] [Ejecución exitosa de publicación de reglas de Firestore](https://github.com/windsor-one/Plataforma/actions/runs/32218890190)

[2] [Ejecución validada de automatizaciones de SIGES](https://github.com/windsor-one/Plataforma/actions/runs/32215961282)

[3] [Despliegue exitoso de GitHub Pages](https://github.com/windsor-one/Plataforma/actions/runs/32219484038)
