export const POSITION_COLORS: Record<string, { bg: string; text: string }> = {
  QB: { bg: "#f6a8c9", text: "#5c1030" },
  RB: { bg: "#5fe0c7", text: "#04372c" },
  WR: { bg: "#7fb8f5", text: "#0b2c52" },
  TE: { bg: "#f5b06a", text: "#4a2603" },
  K: { bg: "#c9b6f2", text: "#301a52" },
  DEF: { bg: "#c9b8a0", text: "#3a2a12" },
};

const FALLBACK_COLOR = { bg: "#e5e0f0", text: "#241a3d" };

export function positionColor(position: string) {
  return POSITION_COLORS[position] ?? FALLBACK_COLOR;
}

export function avatarColor(index: number) {
  const hue = (260 + index * 35) % 360;
  return `hsl(${hue}, 55%, 55%)`;
}

// First letter of the first two words ("Thuy's Thot" -> "TT"), or the first
// two letters of a one-word name ("Melatonin" -> "ME").
export function initials(name: string) {
  const words = name.split(/[^\p{L}\p{N}']+/u).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? name).slice(0, 2);
  return letters.toUpperCase();
}
