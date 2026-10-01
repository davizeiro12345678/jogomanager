import type { ComponentProps } from "react";
import { Crest } from "./Crest";
import { CutsceneStage } from "./cinematic/CutsceneStage";

async function loadSceneVoice(scene: string, line: number): Promise<string | null> {
  const { narrateScene } = await import("@/lib/tts.functions");
  const result = await narrateScene({ data: { scene, line } });
  return result.ok ? result.audio : null;
}

/** Career integration retains official crests, authored audio and choice effects.
 * The renderer is also usable by the standalone graphics studio. */
export function Cutscene(props: Omit<ComponentProps<typeof CutsceneStage>, "loadVoice" | "brand">) {
  return (
    <CutsceneStage
      {...props}
      loadVoice={loadSceneVoice}
      brand={props.club ? <Crest club={props.club} size={32} detail="simple" /> : undefined}
    />
  );
}
