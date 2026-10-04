import { createFileRoute, Link } from "@tanstack/react-router";

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
  return (
    <div className="pitch-bg flex min-h-screen flex-col px-4 py-6">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <div className="mb-4">
          <Link to="/dashboard" className="text-xs uppercase tracking-widest text-primary">
            ← Painel
          </Link>
          <h1 className="font-display text-2xl uppercase tracking-wide">Chat global</h1>
        </div>
        <ChatPanel next="/chat" />
      </div>
    </div>
  );
}
