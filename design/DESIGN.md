---
name: Tenis Pro Ops
colors:
  surface: '#fafaf4'
  surface-dim: '#dadad5'
  surface-bright: '#fafaf4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f4ee'
  surface-container: '#eeeee9'
  surface-container-high: '#e8e8e3'
  surface-container-highest: '#e3e3de'
  on-surface: '#1a1c19'
  on-surface-variant: '#3f4941'
  inverse-surface: '#2f312e'
  inverse-on-surface: '#f1f1ec'
  outline: '#6f7a70'
  outline-variant: '#becabf'
  surface-tint: '#006d40'
  primary: '#00643b'
  on-primary: '#ffffff'
  primary-container: '#1b7f4f'
  on-primary-container: '#d1ffde'
  inverse-primary: '#7dd9a1'
  secondary: '#5b5f5a'
  on-secondary: '#ffffff'
  secondary-container: '#e0e4dc'
  on-secondary-container: '#61655f'
  tertiary: '#903a42'
  on-tertiary: '#ffffff'
  tertiary-container: '#af5259'
  on-tertiary-container: '#fff0f0'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#99f6bb'
  primary-fixed-dim: '#7dd9a1'
  on-primary-fixed: '#002110'
  on-primary-fixed-variant: '#00522f'
  secondary-fixed: '#e0e4dc'
  secondary-fixed-dim: '#c4c8c0'
  on-secondary-fixed: '#191d18'
  on-secondary-fixed-variant: '#444842'
  tertiary-fixed: '#ffdada'
  tertiary-fixed-dim: '#ffb3b5'
  on-tertiary-fixed: '#40000c'
  on-tertiary-fixed-variant: '#7c2b33'
  background: '#fafaf4'
  on-background: '#1a1c19'
  surface-variant: '#e3e3de'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-md-medium:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-xs:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  gutter-desktop: 1rem
  margin: 1rem
  margin-desktop: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

Este sistema de diseño está concebido como una herramienta de trabajo B2B y SaaS utilitario para la administración operativa de clubes de tenis en Colombia. Su propósito es maximizar la eficiencia en la gestión diaria de reservas de canchas, programación de torneos, control de socios y facturación en recepción.

La personalidad visual es rigurosa, clara, compacta y puramente funcional. Se eliminan por completo las ilustraciones decorativas, los efectos de cristal translúcido y los gradientes. Toda la interfaz prioriza la densidad informacional, la legibilidad inmediata en mostradores iluminados o bajo el sol en la caseta de control, y la velocidad de escaneo visual.

- **Tono y Lenguaje:** Español de Colombia en registro corporativo directo y cercano ("canchas", "reservas", "turnos", "socios", "sede").
- **Estilo Visual:** Minimalismo utilitario y estructural. La jerarquía se construye exclusivamente mediante bordes finos, tipografía nítida y fondos de estado con alto contraste funcional.

## Colors

La paleta cromática reproduce el entorno técnico del tenis tradicional sobre arcilla o superficie rápida, manteniendo un rigor accesible (WCAG 2.1 AA mínimo con ratios superiores a 4.5:1 para texto normal y 3:1 para controles interactivos).

### Estructura Base
- **Color Primario (Verde Cancha):** `#1B7F4F` (acciones principales, botones de confirmación, selector activo).
- **Primario Hover/Active:** `#166A42`.
- **Fondo de Aplicación (Canvas):** `#F6F7F5` (gris natural cálido que reduce el cansancio ocular frente a pantallas operativas).
- **Superficie (Cards, Tablas, Paneles):** `#FFFFFF`.
- **Bordes y Divisores Estructurales:** `#E2E4DF`.
- **Texto Principal:** `#1A1C19`.
- **Texto Secundario y Labels:** `#5E625C`.

### Tokens Semánticos de Estado (Disponibilidad de Canchas)
- **Disponible:** Fondo `#EBF6EE`, Texto `#166A42`, Borde `#B8E4C6`.
- **Ocupado:** Fondo `#EDEDEC`, Texto `#616460`, Borde `#D5D7D3`.
- **Bloqueado (Mantenimiento/Clima):** Fondo `#FFF3E6`, Texto `#A35005`, Borde `#FCD3A8`.
- **Cancelado:** Fondo `#F5F5F4`, Texto `#8A8E87`, estilo con tachado (`line-through`) y borde `#E2E4DF`.

## Typography

El sistema utiliza exclusivamente **Inter**, aprovechando su neutralidad técnica, alta legibilidad en números de cancha/horas y proporciones optimizadas para cuadrículas de datos.

- **Jerarquía Compacta:** 
  - `headline-lg` (20px / 500): Títulos de módulos, cabeceras de sede, balances diarios.
  - `headline-sm` (16px / 500): Títulos de tarjetas de cancha, secciones modales, nombres de torneo.
  - `body-md` (14px / 400): Texto de datos, listados de socios, detalles de reservas.
  - `body-md-medium` (14px / 500): Datos numéricos clave, precios en COP, horas de inicio.
  - `label-sm` (12px / 500): Badges de estado, encabezados de columnas en la matriz de turnos, metadatos.
  - `label-xs` (11px / 500): Sub-etiquetas en celdas de ocupación reducida.
- **Formateo Numérico:** En tablas y cronogramas se deben emplear cifras tabulares (`font-variant-numeric: tabular-nums`) para asegurar alineación vertical estricta de horas, minutos y valores monetarios en pesos colombianos ($COP).

## Layout & Spacing

El diseño utiliza una grilla de alta densidad adaptada a interfaces tipo tablero de control (dashboard) y cuadrículas horarias de reservas.

- **Parrilla de Turnos (Matriz Cancha/Hora):** Se implementa como grilla de columnas fijas por cancha (ancho mínimo de 140px por columna) y filas de intervalos de 30 o 60 minutos con altura compacta de 48px o 56px para optimizar el área visible sin necesidad de scroll vertical excesivo.
- **Espaciado y Relleno:** El ritmo base se fundamenta en un módulo de 4px / 8px:
  - `space-xs` (4px): Espacio entre iconos de estado y texto en badges.
  - `space-sm` (8px): Relleno interno de celdas de tabla, gaps de listas compactas.
  - `space-md` (12px): Padding interno vertical de botones, campos de texto e inputs de filtro.
  - `space-lg` (16px): Padding interno de tarjetas de cancha, contenedores modales.
  - `space-xl` (24px): Separación entre bloques de estadísticas y secciones de vista general.
- **Adaptabilidad:** En tablet y móvil, la matriz de canchas conmuta a un selector horizontal de tabs por cancha o vista de lista secuencial de turnos para evitar deslizamiento bidireccional forzado.

## Elevation & Depth

Este sistema prescinde de sombras difusas o elevaciones pronunciadas para mantener una estética rigurosamente plana y utilitaria.

- **Profundidad Basada en Límites (Low-Contrast Outlines):** Toda separación entre componentes, filas y tarjetas se define mediante un borde sólido de `1px` en `#E2E4DF`.
- **Estratificación por Superficie:**
  - Nivel 0 (Fondo base): `#F6F7F5`.
  - Nivel 1 (Cards, Tablas, Contenedores de grilla): `#FFFFFF` con borde `#E2E4DF`.
  - Nivel 2 (Modales, Popovers de reserva rápida, Drawers laterales): `#FFFFFF` con borde `#E2E4DF` y una sombra sutil de contención puramente técnica: `0 4px 12px rgba(26, 28, 25, 0.08)`.
  - Nivel 3 (Overlays / Modales críticos): Fondo opaco `#1A1C19` al 40% sin efecto blur.

## Shapes

La geometría del sistema equilibra solidez estructural y ergonomía visual mediante un radio constante y homogéneo de **8px** (`rounded-lg` / `rounded-[8px]`).

- **Tarjetas, Paneles y Celdas de Reserva:** Radio exterior de 8px. Si se encuentran anidadas dentro de contenedores con padding, las divisiones internas permanecen rectas o usan 4px para no colisionar con el contorno.
- **Controles e Inputs:** Botones, inputs de texto, selects y badges de cancha adoptan estrictamente 8px de radio.
- **Sin Formas Circulares Completas:** Los badges y píldoras nunca usan radio de 9999px (full pill); mantienen el estándar de 6px a 8px para preservar el orden métrico y rectangular del software de gestión.
- **Excepción — Avatares:** un avatar de perfil (iniciales o foto) sí usa radio completo (círculo). No es un badge ni un control de la grilla operativa, es una convención casi universal para representar a una persona, y forzarlo a un cuadrado de 8px lo haría menos reconocible sin ganar orden real a cambio.

## Components

### 1. Botones
- **Primario:** Fondo `#1B7F4F`, texto `#FFFFFF`, borde transparente, radio 8px, padding vertical 10px, padding horizontal 16px, fuente 14px/500. En hover: fondo `#166A42`. En foco: anillo exterior de 2px en `#1B7F4F` con offset de 2px.
- **Secundario / Outline:** Fondo `#FFFFFF`, texto `#1A1C19`, borde de 1px `#E2E4DF`. En hover: fondo `#F6F7F5`, borde `#5E625C`.
- **Destructivo:** Fondo `#FFFFFF`, texto `#A35005`, borde `#FCD3A8`. En hover: fondo `#FFF3E6`.

### 2. Celdas de Grilla de Canchas (Timeline Slot)
- Dimensiones controladas, borde de 1px perimetral según el token de estado.
- **Slot Disponible:** Fondo `#EBF6EE`, borde `#B8E4C6`, texto `#166A42`. Acción click directa: abre formulario rápido de reserva.
- **Slot Ocupado:** Fondo `#EDEDEC`, borde `#D5D7D3`, texto `#616460`. Muestra nombre del socio y tipo de turno (ej. "Sencillos", "Doble", "Clase").
- **Slot Bloqueado:** Fondo `#FFF3E6`, borde `#FCD3A8`, texto `#A35005`. Etiqueta visible (ej. "Mantenimiento / Rodillo", "Lluvia").
- **Slot Cancelado:** Fondo `#F5F5F4`, texto `#8A8E87` con `text-decoration: line-through`, borde `#E2E4DF`.

### 3. Badges / Chips de Estado
- Altura fija de 24px, padding horizontal 8px, radio 6px a 8px, tipografía 12px/500.
- Esquema de colores exacto a los tokens semánticos definidos, manteniendo el borde visible de 1px para garantizar contraste sobre superficies blancas.

### 4. Campos de Entrada (Input Fields & Selects)
- Altura estándar de 40px (densidad adecuada para uso con mouse o pantalla táctil en recepción).
- Fondo `#FFFFFF`, borde 1px en `#E2E4DF`, texto `#1A1C19` (14px/400), placeholder en `#5E625C`.
- Estado activo/focus: borde `#1B7F4F` y contorno de foco accesible sin distorsión de escala.
- Etiquetas (labels): 12px/500 en `#5E625C`, posicionadas siempre arriba del campo con espaciado de 4px.

### 5. Tarjetas de Resumen y Listas de Socios
- Contenedor en fondo `#FFFFFF`, borde 1px `#E2E4DF`, radio 8px, padding 16px.
- Las filas dentro de una lista utilizan división por línea horizontal sólida de 1px `#E2E4DF`, con padding vertical de 10px y efecto hover sutil con fondo `#F6F7F5`.

### 6. Controles de Selección (Checkboxes & Radios)
- Checkboxes cuadrados de 16x16px con radio de 4px, borde 1.5px `#5E625C`. Al seleccionarse: fondo `#1B7F4F`, borde `#1B7F4F` con check blanco en contraste directo.

### 7. Switch (Activar/Desactivar)
- Para estados binarios accionables (activo/inactivo de una fila), no un checkbox con texto al lado.
- Pista rectangular de 40x24px, radio 6px (no 9999px — ver "Sin Formas Circulares Completas"), borde 1.5px `#5E625C`. Perilla interna cuadrada de 16x16px, radio 4px, que se desliza sin volverse circular.
- Apagado: pista `#FFFFFF`, perilla `#5E625C`. Encendido: pista y borde `#1B7F4F`, perilla `#FFFFFF`.
- El estado se sigue leyendo por posición y color de la perilla, no requiere la palabra "Activa/Inactiva" junto al control.

### 8. Botones de Icono (Acciones de Fila)
- Acciones repetidas por fila en una tabla (Editar, Eliminar) van como icono dentro de un cuadrado de 32x32px, radio 8px — no como texto con subrayado.
- El icono siempre lleva `aria-label` y `title` con el verbo completo (ej. "Editar cancha"), nunca solo el icono sin texto accesible.
- Tono neutro (`#5E625C`, hover fondo `#F6F7F5`) para acciones no destructivas; tono destructivo (`#A35005` sobre fondo `#FFF3E6` en hover) para eliminar, consistente con el botón Destructivo de la sección 1.
- Los indicadores binarios de una característica de fila (ej. cubierta, iluminación) siguen el mismo espíritu: icono dentro de una insignia de 28x28px, radio 6px, con `aria-label`/`title` describiendo el estado — en vez de una insignia de texto "Sí/No".

### 9. Menú Hamburguesa (Mobile)
- El encabezado no tiene tratamiento propio en mobile por defecto: en pantalla angosta, los enlaces de área y "Cambiar de club" del nav de escritorio se ocultan (`hidden md:flex`) y se accede a ellos desde un botón de icono `menu`/`close` de 36x36px, radio 8px, junto al avatar de perfil.
- El panel desplegable es el mismo contenido del nav de escritorio, sin agregar ni quitar opciones — solo cambia dónde vive. Contenedor 224px de ancho, radio 8px, sombra de Nivel 2, se cierra con click afuera, Escape o al elegir una opción.

### 10. Menú de Perfil
- Reemplaza el nombre en texto plano + botón "Salir" siempre visibles del encabezado, en mobile y escritorio por igual.
- Botón: avatar circular de 36px (ver excepción de Avatares en Shapes) con las iniciales del nombre, fondo `--color-primary` (el color real del club activo), texto blanco.
- Panel: mismo contenedor que el menú hamburguesa (224px, radio 8px, sombra de Nivel 2), con nombre y correo arriba (no interactivo), separador, y las acciones de la sesión (ej. "Mi perfil", "Salir") como filas de 40px con icono + texto.