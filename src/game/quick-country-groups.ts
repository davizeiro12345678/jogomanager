/** Directory-only grouping; this module never imports clubs, squads or React. */
export function groupQuickMatchLeagues<LeagueDef extends { readonly country: string }>(
  leagues: readonly LeagueDef[],
  locale: string,
): Array<[country: string, leagues: LeagueDef[]]> {
  const groups = new Map<string, LeagueDef[]>();
  for (const league of leagues) {
    const group = groups.get(league.country);
    if (group) group.push(league);
    else groups.set(league.country, [league]);
  }
  const compare = new Intl.Collator(locale).compare;
  return [...groups].sort(([left], [right]) =>
    left === "Brasil" ? -1 : right === "Brasil" ? 1 : compare(left, right),
  );
}
