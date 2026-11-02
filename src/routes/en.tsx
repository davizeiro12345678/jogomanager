import { createFileRoute } from "@tanstack/react-router";
import { InternationalHome } from "@/components/home/InternationalHome";
import { canonical, homeLanguageLinks, seoMeta } from "@/lib/seo";

export const Route = createFileRoute("/en")({
  head: () => ({
    meta: seoMeta({
      title: "Free Football Manager Game in 3D | jogomanager",
      description:
        "Become a football manager, build your squad and follow 3D matches. Start your coaching career free in your browser on mobile or desktop.",
      path: "/en",
      locale: "en_US",
      imageAlt: "jogomanager football management game and 3D stadium",
      keywords: [
        "football manager game",
        "soccer manager game",
        "free football management game",
        "football coaching game",
        "football manager browser game",
        "football tactics game",
        "3D football simulation",
        "football club management",
      ],
    }),
    links: [...canonical("/en"), ...homeLanguageLinks()],
  }),
  component: () => <InternationalHome locale="en" />,
});
