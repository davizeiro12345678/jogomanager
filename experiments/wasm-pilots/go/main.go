package main

// Port of src/game/ai-halftime.ts halfTimePlan. Tactics are packed as ints;
// the result packs pressing, mentality, width, tempo and a notes bitmask.

func clamp(n, lo, hi int32) int32 {
	if n < lo {
		return lo
	}
	if n > hi {
		return hi
	}
	return n
}

//export halfTimePlan
func halfTimePlan(ownGoals, ownShots, ownPoss, foeGoals, foeShots, foePoss,
	pressing, mentality, width, tempo, foeWidth, foePressing int32) int32 {
	var notes int32
	diff := ownGoals - foeGoals
	if foePoss >= 58 && pressing < 2 {
		pressing++
		notes |= 1
	}
	if foeShots >= 6 && foeShots >= ownShots*2 {
		mentality = clamp(mentality-1, 0, 4)
		width = clamp(width-1, 0, 2)
		notes |= 2
	}
	if foeWidth >= 2 && width < 2 && notes&2 == 0 {
		width++
		notes |= 4
	}
	if foePressing >= 2 && tempo < 2 {
		tempo++
		notes |= 8
	}
	if diff < 0 {
		mentality = clamp(mentality+1, 0, 4)
		notes |= 16
	} else if diff >= 2 {
		mentality = clamp(mentality-1, 0, 4)
		notes |= 32
	}
	return pressing | mentality<<4 | width<<8 | tempo<<12 | notes<<16
}

func main() {}
