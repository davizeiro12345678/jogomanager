---
name: "Pro Football Manager 3D"
version: 1
colors:
  background-dark: "oklch(0.16 0.012 210)"
  foreground-dark: "oklch(0.97 0.014 150)"
  surface-dark: "oklch(0.218 0.014 205)"
  primary-dark: "oklch(0.79 0.19 148)"
  background-light: "oklch(1 0 0)"
  primary-light: "oklch(0.208 0.042 265.755)"
typography:
  display:
    fontFamily: "Archivo Black, system-ui, sans-serif"
  body:
    fontFamily: "Hind, system-ui, sans-serif"
  utility:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
rounded:
  DEFAULT: "0.625rem"
  sm: "0.375rem"
components:
  athlete-card:
    description: "Surface defined by the athlete.css shared CSS rules"
  career-hub-priority:
    description: "One actionable decision at a time, linking into the player workflow"
---

# Design contract for career modes

## North star

A football career archive, not a generic analytics dashboard. A save is a story in progress: the club crest, player name, shirt number, season, stakes and the **next meaningful decision** are the visual language.

## Owners and implementation

- The global CSS tokens are defined in `src/styles.css`; `@theme inline` is their Tailwind adapter. Do not duplicate a runtime design-token map here.
- `src/components/game/athlete.css` owns the player-career cards, creation steps, goals and priority surfaces. `src/components/game/career-create.css` owns the manager creation flow.
- `src/routes/carreiras.tsx` owns the combined archive; `src/routes/jogador.novo.tsx` owns athlete creation; `src/routes/jogador.painel.tsx` owns the active athlete dashboard.

## Product behavior

- Brazilian Portuguese remains the authoritative language for visible career copy.
- A save must not be overwritten simply by visiting its creation page; preserve the three existing player slots.
- Creation is progressive disclosure: identity and position; background and club; visual and final review. Navigation back preserves all input. 3D is loaded only on the final step.
- The hub surfaces exactly one next decision and links to the relevant workflow. Career goals reflect position and season stats, not arbitrary daily timers.
- Make cloud sync claims only for the save type whose server-confirmed state is known.
- Use semantic buttons, labeled inputs, keyboard-visible focus, minimum 44px high decision targets, motion reduction and single-column layouts on phones.
- Goals and consequences stay readable without color; progress has an accessible label and numeric text.

## Visual signature

The goal board is a **season scorecard** rather than an ornamental KPI grid. Club colors mark progress and crest identity, while high-risk choices show explicit consequences and plain-language guidance.

## Validation

Before release run lint, TypeScript, relevant Vitest cases, build, keyboard/phone checks, save migration compatibility and an offline-to-online conflict test. CI is blocked while issue #44 leaves the npm lockfile out of sync. Do not infer that commits to this branch are production deployed.
