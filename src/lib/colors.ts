import type { ColorId } from "@shared/stroop";

// The colour order and palettes live with the game rules, which the server
// shares to check ranked runs.
export { COLOR_ORDER, paletteFor, type ColorId } from "@shared/stroop";

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
