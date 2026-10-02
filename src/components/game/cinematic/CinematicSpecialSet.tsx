import type { Speaker } from "@/content/cutscenes";
import { CinematicActor } from "./CinematicActor";
import { cinematicSurface } from "./cinematic-surfaces";

import { CinematicDumbbell } from "./CinematicDumbbell";

/** Shared adult rigs, distinct places for recovery and gym cinematics. */
export function CinematicSpecialSet({
  medical,
  primary,
  speaker,
}: {
  medical: boolean;
  primary: string;
  speaker: Speaker | null;
}) {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[18, 14]} />
        <meshStandardMaterial
          color={medical ? "#849b9e" : "#343e46"}
          map={cinematicSurface("tile")}
          roughness={0.82}
        />
      </mesh>
      <mesh position={[0, 2.4, -4.4]} receiveShadow>
        <boxGeometry args={[18, 4.8, 0.2]} />
        <meshStandardMaterial
          color={medical ? "#aac3ca" : "#475862"}
          map={cinematicSurface("wall")}
          roughness={0.88}
        />
      </mesh>
      {[-7, 7].map((x) => (
        <mesh key={x} position={[x, 2.4, 0]} receiveShadow>
          <boxGeometry args={[0.2, 4.8, 14]} />
          <meshStandardMaterial color={medical ? "#72949f" : "#293842"} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 1.18, -4.23]}>
        <boxGeometry args={[14, 0.12, 0.03]} />
        <meshStandardMaterial color={primary} roughness={0.75} />
      </mesh>
      <mesh position={[-0.4, 0.44, 0.6]} castShadow receiveShadow>
        <boxGeometry args={[medical ? 2.2 : 1.8, 0.16, 0.72]} />
        <meshStandardMaterial color={medical ? "#d9e8e8" : "#243139"} roughness={0.72} />
      </mesh>
      {[-1.3, 0.5].map((x) => (
        <mesh key={x} position={[x, 0.21, 0.6]}>
          <boxGeometry args={[0.08, 0.42, 0.65]} />
          <meshStandardMaterial color="#536976" metalness={0.6} roughness={0.45} />
        </mesh>
      ))}
      <CinematicActor
        x={-0.4}
        z={0.6}
        rot={-0.1}
        pose="sit"
        color={primary}
        seed={5}
        role="captain"
        exercise={!medical}
        attention={[0.2, -2.1]}
        acting={speaker === "captain"}
      />
      <CinematicActor
        x={0.2}
        z={-2.1}
        color={medical ? "#d6e7e9" : "#243b45"}
        shorts="#21313b"
        seed={21}
        role="doctor"
        attention={[-0.4, 0.6]}
        acting={speaker !== "captain" && speaker !== "narrator"}
      />
      {medical ? (
        <group>
          <group position={[3.2, 0, -2.4]}>
            <mesh position={[0, 1.25, 0]}>
              <boxGeometry args={[1, 0.65, 0.14]} />
              <meshStandardMaterial color="#243d49" roughness={0.65} />
            </mesh>
            <mesh position={[0, 1.25, 0.08]}>
              <planeGeometry args={[0.84, 0.5]} />
              <meshBasicMaterial color="#162b31" />
            </mesh>
            <mesh position={[0, 1.25, 0.09]}>
              <boxGeometry args={[0.68, 0.016, 0.008]} />
              <meshBasicMaterial color="#8eddab" />
            </mesh>
            {[0, 1, 2].map((i) => (
              <mesh
                key={i}
                position={[-0.24 + i * 0.22, 1.26, 0.1]}
                rotation-z={i === 1 ? -0.8 : 0.65}
              >
                <boxGeometry args={[0.11, 0.012, 0.008]} />
                <meshBasicMaterial color="#8eddab" />
              </mesh>
            ))}
            <mesh position={[0, 0.55, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 1.1, 8]} />
              <meshStandardMaterial color="#90a7b0" metalness={0.65} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.05, 0]}>
              <boxGeometry args={[0.5, 0.1, 0.5]} />
              <meshStandardMaterial color="#6c8390" roughness={0.6} />
            </mesh>
          </group>
          <mesh position={[-4.4, 1.1, -3.6]}>
            <boxGeometry args={[2.2, 2.2, 0.75]} />
            <meshStandardMaterial color="#c0d4d9" roughness={0.7} />
          </mesh>
          {[-5, -3.85].map((x) => (
            <mesh key={x} position={[x, 1.15, -3.2]}>
              <boxGeometry args={[0.03, 0.32, 0.04]} />
              <meshStandardMaterial color="#6b8d97" metalness={0.6} roughness={0.35} />
            </mesh>
          ))}
          <group position={[-2, 2.7, -4.23]}>
            <mesh>
              <boxGeometry args={[0.14, 0.65, 0.03]} />
              <meshStandardMaterial color="#c65c60" roughness={0.8} />
            </mesh>
            <mesh>
              <boxGeometry args={[0.65, 0.14, 0.03]} />
              <meshStandardMaterial color="#c65c60" roughness={0.8} />
            </mesh>
          </group>
        </group>
      ) : (
        <group>
          {[-4.6, 4.6].map((x) => (
            <group key={x} position={[x, 0, -2.8]}>
              {[-0.7, 0.7].map((side) => (
                <mesh key={side} position={[side, 1.1, 0]}>
                  <boxGeometry args={[0.09, 2.2, 0.09]} />
                  <meshStandardMaterial color="#8b9aa5" metalness={0.65} roughness={0.45} />
                </mesh>
              ))}
              {[0.7, 1.45].map((y) => (
                <group key={y}>
                  <mesh position={[0, y, 0]}>
                    <boxGeometry args={[1.6, 0.06, 0.45]} />
                    <meshStandardMaterial color="#303e49" roughness={0.65} />
                  </mesh>
                  {[-0.5, 0, 0.5].map((side) => (
                    <group key={side} position={[side, y + 0.1, 0]}>
                      <CinematicDumbbell />
                    </group>
                  ))}
                </group>
              ))}
            </group>
          ))}
          <mesh position={[0, 1.9, -4.23]}>
            <boxGeometry args={[3.6, 1.5, 0.025]} />
            <meshStandardMaterial color="#8da3ad" metalness={0.75} roughness={0.23} />
          </mesh>
          {[-3.2, 3.2].map((x) => (
            <mesh key={x} position={[x, 0.014, 2.6]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[1.5, 2.6]} />
              <meshStandardMaterial color="#274950" roughness={0.95} />
            </mesh>
          ))}
        </group>
      )}
      {[-3.5, 0, 3.5].map((x) => (
        <mesh key={x} position={[x, 3.5, -1]}>
          <boxGeometry args={[2.6, 0.08, 0.3]} />
          <meshBasicMaterial color={medical ? "#e7fbff" : "#fff0d6"} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
