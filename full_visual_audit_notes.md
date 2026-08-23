# Auditoría visual integral — notas de trabajo

## Alcance inventariado

La plataforma usa `client/src/components/Dashboard.tsx` como shell principal y monta módulos de Resumen, Calendario, Correo interno, Clientes, Reservas, Pagos, Productos, Tareas e incidencias, Recursos Humanos, Actualizaciones, Automatizaciones, reportes RR. HH., rendimiento, impacto digital, finanzas, centro de informes, planilla, Personal, Historial, Operación, Seguridad y perfil. Los módulos secundarios están en componentes separados: `FinancePanel`, `HrPanel`, `UpdateRequestsPanel`, `WorkPanel`, `InternalMailPanel`, `AutomationsPanel`, `ImpactPanel`, `ReportsCenterPanel`, `PayrollPanel`, `OverviewDashboard`, `HrInsightsPanel`, `GlobalSearch`, `AIChatBox` y componentes compartidos de UI.

## Hallazgos confirmados

1. La última corrección del organigrama sí está en `main` y publicada en GitHub Pages, pero la revisión previa solo cubrió directamente el organigrama, el shell global y la pantalla de configuración.
2. El indicador de conexión tenía un conflicto de clases (`grid` + `inline-flex`) que podía desalinear el icono. Ya se convirtió en un componente de icono único.
3. La interfaz comparte clases globales (`panel-card`, `primary-button`, `secondary-button`, `icon-button`, `field`, tablas y navegación), por lo que una parte importante de la armonización puede resolverse en `index.css`, pero aún hay overrides y densidades específicas por módulo que requieren revisión individual.
4. El entorno local no tiene Firebase configurado, por lo que la vista autenticada no puede abrirse con datos reales en el navegador de sandbox. La validación visual directa disponible es la pantalla de configuración; el resto se auditará por código y compilación, y la publicación se comprobará contra GitHub Pages.
5. El repositorio está en `windsor-one/Plataforma`, rama `main`, con flujo de despliegue automático de GitHub Pages.

## Regla de trabajo

No se deben ocultar problemas con escalado global ni romper tablas en móvil. Los controles deben conservar un área táctil cómoda, las tablas deben desplazarse horizontalmente cuando su contenido lo exija y las acciones con icono deben tener `title` y/o `aria-label`.

## Ronda de armonización aplicada

Se normalizaron los encabezados de página en Resumen, Finanzas, Trabajo, Recursos Humanos, Impacto digital, Correo, Planilla, Automatizaciones, Centro de Informes y Solicitudes. Se reforzó la separación responsive entre títulos, descripciones y acciones. Se ajustaron filtros y campos de período, tamaños de entradas numéricas en Planilla, estados vacíos, tablas y métricas compartidas. El icono de conexión quedó como elemento único sin texto visible, conservando `title`, `role=status`, `aria-live` y texto para lector de pantalla.

## Verificación pública

El commit `03c7756` quedó publicado mediante GitHub Pages. La URL pública carga correctamente la pantalla de acceso; la vista autenticada no es accesible sin la sesión del usuario, por lo que la comprobación directa de módulos requiere credenciales o un navegador conectado. La pantalla pública mantiene proporciones equilibradas y controles de acceso con áreas cómodas.

## Rediseño de acceso

Se reemplazó la composición anterior de login por un panel dividido inspirado en la referencia: fondo azul geométrico, panel de identidad SIGES y formulario claro con campos acompañados por iconos. Se conservaron el contexto, los textos funcionales, recuperación de contraseña, registro por invitación, validaciones y flujo Firebase. El contenido visible de acceso incluye SIGES, Acceso seguro, SIGES · Acceso del equipo, Vuelve a tu operación., Inicia sesión con tus credenciales de empleado., Correo, nombre@empresa.com, Contraseña, Mínimo 6 caracteres, Iniciar sesión, recuperación, registro, los dos avisos de seguridad y el pie institucional.
