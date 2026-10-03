/** Anchored to a hand; the dynamic marker keeps it out of static batching. */
export function CinematicClipboard() {
  return (
    <group position={[0.035, -0.07, 0.045]} rotation-x={-0.2} userData={{ cinematicDynamic: true }}>
      <mesh>
        <boxGeometry args={[0.18, 0.26, 0.012]} />
        <meshStandardMaterial color="#29404e" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0, 0.008]}>
        <planeGeometry args={[0.15, 0.22]} />
        <meshStandardMaterial color="#e5e2d3" roughness={0.92} />
      </mesh>
      <mesh position={[0, 0.105, 0.012]}>
        <boxGeometry args={[0.065, 0.02, 0.012]} />
        <meshStandardMaterial color="#9caeb7" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}
