export function CinematicDumbbell({ dynamic = false }: { dynamic?: boolean }) {
  return (
    <group rotation-z={Math.PI / 2} userData={{ cinematicDynamic: dynamic }}>
      <mesh>
        <cylinderGeometry args={[0.015, 0.015, 0.24, 8]} />
        <meshStandardMaterial color="#95a5af" metalness={0.65} roughness={0.35} />
      </mesh>
      {[-0.105, 0.105].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[0.065, 0.065, 0.06, 10]} />
          <meshStandardMaterial color="#26333e" roughness={0.65} metalness={0.25} />
        </mesh>
      ))}
    </group>
  );
}
