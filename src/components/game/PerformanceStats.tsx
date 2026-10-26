import { Stats } from "@react-three/drei/core/Stats.js";
import styles from "./performance-stats.module.css";

/** Uses the existing Drei runtime; does not mount a second engine tree. */
export default function PerformanceStats() {
  return <Stats className={styles["stats"] ?? ""} />;
}
