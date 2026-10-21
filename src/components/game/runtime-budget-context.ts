import { createContext, useContext } from "react";

import {
  resolveRuntimeSceneBudget,
  type RuntimeSceneBudget as RuntimeSceneBudgetValue,
} from "@/game/runtime-scene-budget";

export const QualityPressure = createContext(0);

export const useQualityPressure = () => useContext(QualityPressure);

export const RuntimeSceneBudgetContext = createContext<RuntimeSceneBudgetValue>(
  resolveRuntimeSceneBudget("media"),
);

export const useRuntimeSceneBudget = () => useContext(RuntimeSceneBudgetContext);
