import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Astro genera las rutas; las funciones interactivas y los datos del usuario
// se gestionan en el navegador para mantener el despliegue sin servidor.
export default defineConfig({
  compressHTML: true,
  vite: {
    plugins: [tailwindcss()],
  },
});
