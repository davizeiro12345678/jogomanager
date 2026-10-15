import { createFileRoute } from "@tanstack/react-router";
import { GameShell } from "@/components/game/GameShell";
import { ScreenHeader, SectionCard } from "@/components/game/screen-kit";
import { useCareer } from "@/hooks/useCareer";

import { ChatPanel } from "@/components/game/ChatPanel";

export const Route = createFileRoute("/chat")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Chat global · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Converse com outros treinadores no chat global da comunidade e compartilhe suas experiências no jogo.",
      },
      {
        property: "og:title",
        content: "Chat global · Pro Football Manager 3D",
      },
      {
        property: "og:description",
        content:
          "Converse com outros treinadores no chat global da comunidade e compartilhe suas experiências no jogo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { career } = useCareer();
  return (
    <GameShell career={career}>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <ScreenHeader title="Chat global" description="Converse com a comunidade de treinadores." />
        <SectionCard className="mt-5 flex min-h-[28rem] flex-1 flex-col">
          <ChatPanel next="/chat" />
        </SectionCard>
      </div>
    </GameShell>
  );
}
