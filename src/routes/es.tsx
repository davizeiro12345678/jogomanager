import { createFileRoute } from "@tanstack/react-router";
import { InternationalHome } from "@/components/home/InternationalHome";
import { canonical, homeLanguageLinks, seoMeta } from "@/lib/seo";

export const Route = createFileRoute("/es")({
  head: () => ({
    meta: seoMeta({
      title: "Juego de Mánager de Fútbol Gratis en 3D | jogomanager",
      description:
        "Sé entrenador de fútbol, prepara tu plantilla y sigue partidos en 3D. Comienza tu carrera gratis en el navegador, desde el móvil o el ordenador.",
      path: "/es",
      locale: "es_ES",
      imageAlt: "jogomanager: gestión de fútbol y estadio en 3D",
      keywords: [
        "juego de mánager de fútbol",
        "juego de entrenador de fútbol",
        "manager de fútbol gratis",
        "juego de fútbol en navegador",
        "simulador de fútbol 3D",
        "gestión de clubes",
        "tácticas de fútbol",
        "carrera de entrenador",
      ],
    }),
    links: [...canonical("/es"), ...homeLanguageLinks()],
  }),
  component: () => <InternationalHome locale="es" />,
});
