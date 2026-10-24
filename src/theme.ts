export interface Day {
  date: string;   // YYYY-MM-DD
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface Calendar {
  weeks: Day[][];  // weeks[weekIndex][weekday 0=Sun..6=Sat]
}

export interface Theme {
  empty: string;
  levels: [string, string, string, string];
  glow: string;
  label: string;
  dragonBody: string;
  dragonShade: string;
  dragonLine: string;
  spike: string;
  accent: string;
}

export const THEMES: Record<"dark" | "light", Theme> = {
  dark: {
    empty: "#1B2129",
    levels: ["#123B33", "#0C6B5C", "#0C9F8A", "#00F5D4"],
    glow: "#00F5D4",
    label: "#8B949E",
    dragonBody: "#0C9F8A",
    dragonShade: "#065F4E",
    dragonLine: "#033830",
    spike: "#0A7A68",
    accent: "#E6FFFB",
  },
  light: {
    empty: "#EAEDF0",
    levels: ["#D6F5EC", "#9FE8D5", "#35C4A5", "#00947C"],
    glow: "#00A98A",
    label: "#57606A",
    dragonBody: "#12B49A",
    dragonShade: "#0C7A67",
    dragonLine: "#085447",
    spike: "#0C7A67",
    accent: "#0D1117",
  },
};

export function levelOf(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}
