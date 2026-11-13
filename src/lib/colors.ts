export type ColorId =
  | "red"
  | "blue"
  | "green"
  | "yellow"
  | "purple"
  | "orange"
  | "pink"
  | "cyan"
  | "white";

export interface StroopColor {
  id: ColorId;
  /** Word shown on screen and spoken by the soundbot. */
  name: string;
  /** Ink colour, tuned to stay distinct on the near-black stage. */
  hex: string;
}

export const COLORS: Record<ColorId, StroopColor> = {
  red: { id: "red", name: "RED", hex: "#ff3b3b" },
  blue: { id: "blue", name: "BLUE", hex: "#3d7dff" },
  green: { id: "green", name: "GREEN", hex: "#2fd65a" },
  yellow: { id: "yellow", name: "YELLOW", hex: "#ffe23b" },
  purple: { id: "purple", name: "PURPLE", hex: "#a64bff" },
  orange: { id: "orange", name: "ORANGE", hex: "#ff8a1f" },
  pink: { id: "pink", name: "PINK", hex: "#ff5fc8" },
  cyan: { id: "cyan", name: "CYAN", hex: "#2fe3e8" },
  white: { id: "white", name: "WHITE", hex: "#f4f4f0" },
};

/** Palettes grow in this order: 3 → 6 → 9 options. */
export const COLOR_ORDER: ColorId[] = [
  "red",
  "blue",
  "green",
  "yellow",
  "purple",
  "orange",
  "pink",
  "cyan",
  "white",
];

export function paletteFor(options: number): ColorId[] {
  return COLOR_ORDER.slice(0, options);
}
