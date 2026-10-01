/**
 * Passe de correção de cor (LUT 3D).
 *
 * Feito à mão em vez de `wrapEffect` porque o `LUT3DEffect` precisa de uma
 * textura no construtor — o r3f não consegue recriá-lo com zero argumentos.
 * Montamos o efeito uma vez por combinação (horário × clima × momento) e
 * entregamos o objeto pronto ao `EffectComposer`.
 */
import { createElement, useEffect, useMemo } from "react";
import { BlendFunction, LUT3DEffect } from "postprocessing";

import {
  gradeLut,
  type GradeMoment,
  type GradeTime,
  type GradeWeather,
} from "@/game/graphics/grade";

export function GradeLut({
  time,
  weather,
  moment = "match",
}: {
  time: GradeTime;
  weather: GradeWeather;
  moment?: GradeMoment;
}) {
  const lut = useMemo(() => gradeLut(time, weather, moment), [time, weather, moment]);
  const effect = useMemo(
    () =>
      new LUT3DEffect(lut, {
        blendFunction: BlendFunction.NORMAL,
        // interpolação tri-linear: a tetraédrica é mais precisa, porém exige
        // GLSL3 e derruba o quadro em drivers antigos. 24³ já interpola bem.
        tetrahedralInterpolation: false,
      }),
    [lut],
  );

  useEffect(() => () => effect.dispose(), [effect]);

  return createElement("primitive", { object: effect, dispose: null });
}

export default GradeLut;
