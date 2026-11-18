# Spotify Astro — Proyecto RA3 (ULagos)

Aplicación interactiva para navegador inspirada en **Spotify Web Player**, migrada a **Astro 7** y construida con Tailwind CSS 4 y JavaScript vanilla. Incluye inicio de sesión y compra de planes en modo demostración; el perfil, la sesión, el plan, las preferencias, los likes y las playlists se guardan en `localStorage`. La búsqueda consulta la API pública de iTunes y puede reproducir muestras cortas. No usa backend ni la API oficial de Spotify.

El proyecto HTML original se conserva intacto en `../html/Spotify-dos/`.

## Rutas

| Ruta | Sección |
| --- | --- |
| `/` | Inicio (recomendaciones, tendencias, artistas) |
| `/iniciar-sesion` | Inicio de sesión de demostración |
| `/buscar` | Búsqueda con filtros y resultados |
| `/biblioteca` | Biblioteca y playlists del usuario |
| `/explorar` | Explorar géneros, moods y novedades |
| `/acerca` | Acerca del proyecto y documentación |
| `/detalle?tipo=&id=` | Detalle de álbum, artista, playlist o género |
| `/premium` | Confirmación de compra de demostración (sin cobros) |
| `/cuenta` | Perfil local, preferencias y biblioteca personal |

## Requisitos

- Node.js 22.23.4 o superior (requisito de Astro 7).
- Navegador moderno (Chrome, Firefox, Safari, Edge).

## Desarrollo

```bash
npm install
npm run dev
```

Astro levanta el servidor en `http://localhost:4321`.

## Build y preview

```bash
npm run build
npm run preview
```

Astro genera las rutas en `dist/`; la interacción dinámica se ejecuta en el navegador.

## Estructura

```
public/
  assets/
    img/          imágenes locales (álbumes, artistas, géneros, playlists)
    js/           data, store, audio, cards, views, shell, script e iconos
  .nojekyll
src/
  components/
    AmbientBackdrop.astro  fondo ambiental reutilizable del shell
  layouts/
    BaseLayout.astro   documento HTML, metadatos y shell del reproductor
  pages/
    index.astro
    buscar.astro
    biblioteca.astro
    explorar.astro
    acerca.astro
    detalle.astro
    iniciar-sesion.astro
    premium.astro
    cuenta.astro
  lib/
    musicApi.ts  cliente tipado para la API pública de iTunes
  styles/
    global.css   entrada de Tailwind 4 + tokens
    style.css    estilos propios del reproductor
astro.config.mjs
```

## Notas técnicas

- `BaseLayout.astro` recibe `page`, `title` y `description`; el atributo `data-page` indica al controlador qué vista renderizar.
- Los scripts de `public/assets/js/` se cargan como scripts clásicos en orden, porque comparten funciones globales. El cliente tipado `src/lib/musicApi.ts` se compila con Astro y se expone al reproductor desde `BaseLayout.astro`.
- Tailwind se compila con `@tailwindcss/vite`. En `src/styles/global.css` se declara `source(none)` y se añaden únicamente `src/**/*.astro` y `public/assets/js/**/*.js` como fuentes, para no escanear los otros proyectos del directorio.
- `style.css` se mantiene dentro de `@layer components` para que las utilidades de Tailwind puedan sobrescribirlo.
- La búsqueda y las muestras de audio consultan la API pública de iTunes desde el navegador; no requiere credenciales. El catálogo local se conserva, y cada canción busca una muestra coincidente al reproducirse.
- iTunes solo ofrece clips de vista previa, no canciones completas; la disponibilidad depende del catálogo regional. El reproductor enlaza a Apple Music cuando hay una coincidencia.
- El estado de la interfaz del reproductor persiste en `localStorage` bajo la clave `sp2_playerState`; el audio no se reanuda automáticamente tras recargar la página.
- Las playlists creadas por el usuario se guardan en `sp2_userPlaylists`.
- El perfil editable, el plan y las preferencias también se guardan localmente. Desde Cuenta se pueden borrar todos los datos de esta aplicación almacenados en el navegador.
- El inicio de sesión es solo demostrativo: cualquier contraseña válida en el formulario permite entrar; no se valida contra un servidor ni se guarda. La restricción de páginas se ejecuta en el navegador y no reemplaza autenticación real.
- La compra de planes es una simulación local. No se solicitan datos de pago ni se realizan cobros.
- Las rutas internas son limpias (`/buscar`, `/detalle?...`) y funcionan con el formato de build por carpetas de Astro.

## Créditos fotográficos

Se actualizaron tres retratos con imágenes de Wikimedia Commons, recortadas y optimizadas para el catálogo. Sus autores y licencias también se muestran en **Acerca de**:

| Artista | Autor | Fuente | Licencia |
| --- | --- | --- | --- |
| Mon Laferte | Secretaría de Cultura Ciudad de México | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:MX_KG_MON_LAFERTE_(49635605121).jpg) | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) |
| Kendrick Lamar | Fuzheado | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Pulitzer2018-portraits-kendrick-lamar_(cropped).jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Coldplay | Raph_PH | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:ColdplayManch030623_(38_of_118)_(52950418429).jpg) | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) |

## Despliegue

El proyecto no requiere servidor de aplicación: sirve las páginas y ejecuta sus funciones dinámicas en el navegador. Se puede publicar `dist/` en Netlify, Vercel, Cloudflare Pages, GitHub Pages o cualquier hosting web; los datos personales permanecen en el navegador y no se sincronizan entre dispositivos.

> Si se publica en un subdirectorio (por ejemplo `usuario.github.io/Spotify-dos/`), hay que configurar `base` en `astro.config.mjs` y prefijar las rutas internas generadas por el JavaScript. La configuración actual asume despliegue en la raíz.
