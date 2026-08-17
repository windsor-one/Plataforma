# Direcciones de diseño para GestionPro

## Tres enfoques considerados

### Ruta 1 — Sala de Operaciones Editorial
**Introducción breve:** Un espacio de trabajo sereno y preciso, inspirado en los tableros de control de estudios de diseño y despachos modernos. Convierte datos operativos en una experiencia clara, humana y confiable.

**Probabilidad:** 0.071

### Ruta 2 — Terminal Cívica
**Introducción breve:** Una estética de señalética pública y sistemas administrativos, con contrastes fuertes, jerarquía tipográfica y bloques funcionales. Prioriza el sentido de orden y responsabilidad.

**Probabilidad:** 0.034

### Ruta 3 — Jardín de Servicio
**Introducción breve:** Una interfaz cálida y orgánica que utiliza tonos naturales y formas suaves para hacer que la gestión diaria se sienta menos mecánica. Está pensada para negocios orientados a la atención personal.

**Probabilidad:** 0.089

---

## Enfoque elegido — Sala de Operaciones Editorial

### Movimiento de diseño
El producto adopta una interpretación contemporánea del **estilo tipográfico internacional suizo**, enriquecida con la calidez táctil de una sala de operaciones editorial. La interfaz debe informar antes de decorar: cada agrupación, cifra y acción tiene una jerarquía inequívoca.

### Principios esenciales
1. **Claridad operacional:** La información urgente ocupa el carril principal y las acciones críticas quedan visibles sin perseguir menús.
2. **Densidad respirable:** Las tablas y tarjetas muestran información real, pero conservan márgenes amplios, niveles tipográficos claros y ritmos constantes.
3. **Señales semánticas:** El color está reservado para estados, prioridades y acciones; no se usa como decoración indiscriminada.
4. **Control sin intimidación:** Los permisos, las operaciones destructivas y los estados de empleado se expresan de forma explícita y reversible cuando sea posible.

### Filosofía de color
La base es un **grafito azulado** que comunica concentración y confianza, equilibrado con fondos minerales cálidos para evitar la frialdad de un panel puramente técnico. El verde jade señala actividad y confirmación; el ámbar representa atención; el rojo queda limitado a suspensión y eliminaciones. En modo oscuro, las superficies se vuelven tinta, no negro absoluto, para preservar profundidad y legibilidad.

### Paradigma de composición
La plataforma usa una **columna lateral persistente** como índice operativo, un encabezado de contexto y un lienzo modular asimétrico. El tablero no se centra como una página de marketing: las métricas habitan una banda superior, la agenda tiene una columna amplia y los avisos ocupan una columna de apoyo. En móvil, el índice se convierte en un panel deslizable y la acción principal se mantiene accesible.

### Elementos distintivos
1. **Marcadores de borde:** Barras verticales finas en jade, ámbar o rojo en tarjetas y filas para expresar estado sin saturar etiquetas.
2. **Cifras de registro:** Métricas con números compactos y monoespaciados, evocando una libreta de control.
3. **Tiras de agenda:** Bloques de reserva ordenados por hora con un carril de estado que se lee de un vistazo.

### Filosofía de interacción
Las acciones frecuentes se resuelven directamente en el contexto de la lista mediante menús y diálogos concisos. Las operaciones delicadas requieren una confirmación con lenguaje claro. La aplicación responde con mensajes inmediatos, indicadores de carga discretos y cambios optimistas solo cuando la política de seguridad lo permite.

### Animación
La navegación lateral, los diálogos y los avisos usan entradas de 180 a 260 ms con una curva de salida firme. Las filas nuevas aparecen con una variación breve de opacidad y desplazamiento vertical de 4 px. No se animan cifras continuamente ni se usa movimiento decorativo. Se respeta `prefers-reduced-motion` y las acciones iniciadas por teclado son instantáneas.

### Sistema tipográfico
**Manrope** se utiliza en navegación, títulos y controles por su geometría limpia y legible. **IBM Plex Mono** se reserva para horas, importes, identificadores y métricas. Los encabezados tienen peso 700–800 y tracking compacto; los textos operativos usan 500–600; la información auxiliar usa 400–500 con contraste reducido pero accesible.

### Esencia de marca
**GestionPro es el centro de control diario para equipos de servicio que necesitan ver, coordinar y actuar con orden, sin software corporativo opaco.**

Personalidad: **precisa, próxima, responsable**.

### Voz de marca
Los titulares hablan de la operación actual, nunca de promesas genéricas. Los llamados a la acción son verbos específicos y las microcopias reducen la incertidumbre.

> “La agenda de hoy, resuelta antes de que empiece el día.”

> “Registra el pago y mantén el historial al día.”

### Logotipo y símbolo
La marca se identifica con una **G construida por tres segmentos escalonados**, como una agenda compacta o un circuito de trabajo. El símbolo debe existir sin texto y funcionar en formato cuadrado, con presencia suficiente en la barra lateral y como favicon.

### Color distintivo
**Jade operativo — `#0F8F73`**. Es el color propietario para estados activos, confirmaciones y llamadas a la acción principales.

## Style Decisions

- Los estados bloqueados, vacíos o de configuración conservan la composición de centro operativo: índice lateral, encabezado contextual y módulos que muestran el estado técnico real de la operación.
- El jade operativo se reserva para confirmaciones, acciones y carriles de actividad. Los tonos ámbar expresan preparación pendiente y los rojos se limitan a suspensión o acciones destructivas.
- La voz evita pantallas de bienvenida genéricas y comunica el estado actual de forma concreta: “Configuración pendiente: conecta Firebase para activar agenda, pagos y equipo”.
