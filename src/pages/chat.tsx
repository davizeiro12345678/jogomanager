import { GameShell } from "@/components/game/GameShell";

import { ScreenHeader, SectionCard } from "@/components/game/screen-kit";

import { useCareer } from "@/hooks/useCareer";

import { ChatPanel } from "@/components/game/ChatPanel";

export function ChatPage() {
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
