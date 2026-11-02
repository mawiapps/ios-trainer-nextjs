/** @type {import('next').NextConfig} */
const prep = "/modulos/prep-testgorilla";
const nextConfig = {
  reactStrictMode: true,
  // Rutas viejas: los cursos pasaron a ser módulos y los modos de práctica viven en el módulo de preparación.
  async redirects() {
    return [
      { source: "/cursos", destination: "/modulos", permanent: true },
      { source: "/cursos/:id", destination: "/modulos/:id", permanent: true },
      { source: "/lecciones", destination: prep, permanent: true },
      { source: "/teoria", destination: `${prep}?tab=theory`, permanent: true },
      { source: "/flashcards", destination: `${prep}?tab=flashcards`, permanent: true },
      { source: "/quiz", destination: `${prep}?tab=quiz`, permanent: true },
      { source: "/salida", destination: `${prep}?tab=output`, permanent: true },
      { source: "/codigo", destination: `${prep}?tab=code`, permanent: true },
      { source: "/bugs", destination: `${prep}?tab=bugs`, permanent: true },
      { source: "/entrevista", destination: `${prep}?tab=interview`, permanent: true },
    ];
  },
};
export default nextConfig;
