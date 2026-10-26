import { createContext } from "react";

// Only one immutable batch may own a source hierarchy. An inactive outer
// wrapper leaves the existing local batches in charge.
export const StaticBatchOwner = createContext(false);
