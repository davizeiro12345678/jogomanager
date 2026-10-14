export function eventIcon(type: string) {
  if (type === "goal") return "⚽";
  if (type === "save") return "🧤";
  if (type === "foul") return "🚫";
  if (type === "yellow") return "🟨";
  if (type === "red") return "🟥";
  if (type === "corner") return "🚩";
  if (type === "shot") return "🎯";
  if (type === "kickoff") return "🔔";
  if (type === "sub") return "🔁";
  if (type === "offside") return "⛔";
  if (type === "penalty") return "🥅";
  if (type === "freekick") return "🌀";
  if (type === "injury") return "🚑";
  if (type === "shootout") return "⚖️";
  if (type === "halftime") return "⏸️";
  if (type === "fulltime") return "🏁";
  if (type === "post") return "🥍";
  if (type === "talk") return "📢";
  if (type === "crowd") return "🔥";
  return "•";
}
