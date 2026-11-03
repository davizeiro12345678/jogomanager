using System.Runtime.InteropServices.JavaScript;
return;
public static partial class HalfTime {
  static int Clamp(int n, int lo, int hi) => n < lo ? lo : n > hi ? hi : n;
  // Port of src/game/ai-halftime.ts halfTimePlan, same packing as the Go pilot.
  [JSExport]
  public static int Plan(int ownGoals, int ownShots, int ownPoss, int foeGoals, int foeShots, int foePoss,
      int pressing, int mentality, int width, int tempo, int foeWidth, int foePressing) {
    int notes = 0; int diff = ownGoals - foeGoals;
    if (foePoss >= 58 && pressing < 2) { pressing++; notes |= 1; }
    if (foeShots >= 6 && foeShots >= ownShots * 2) { mentality = Clamp(mentality - 1, 0, 4); width = Clamp(width - 1, 0, 2); notes |= 2; }
    if (foeWidth >= 2 && width < 2 && (notes & 2) == 0) { width++; notes |= 4; }
    if (foePressing >= 2 && tempo < 2) { tempo++; notes |= 8; }
    if (diff < 0) { mentality = Clamp(mentality + 1, 0, 4); notes |= 16; }
    else if (diff >= 2) { mentality = Clamp(mentality - 1, 0, 4); notes |= 32; }
    return pressing | mentality << 4 | width << 8 | tempo << 12 | notes << 16;
  }
}
