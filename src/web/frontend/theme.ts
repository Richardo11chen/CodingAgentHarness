export const theme = {
  bg: {
    marketing: "#08090a",
    panel: "#0f1011",
    surface: "#191a1b",
    hover: "#28282c",
    translucent: "rgba(255,255,255,0.02)",
    translucentHover: "rgba(255,255,255,0.04)",
    translucentActive: "rgba(255,255,255,0.05)",
  },
  text: {
    primary: "#f7f8f8",
    secondary: "#d0d6e0",
    tertiary: "#8a8f98",
    quaternary: "#62666d",
  },
  brand: {
    indigo: "#5e6ad2",
    violet: "#7170ff",
    hover: "#828fff",
  },
  status: {
    green: "#27a644",
    emerald: "#10b981",
    red: "#ef4444",
    yellow: "#f59e0b",
  },
  border: {
    subtle: "rgba(255,255,255,0.05)",
    standard: "rgba(255,255,255,0.08)",
    solid: "#23252a",
  },
  radius: {
    micro: "2px",
    small: "4px",
    standard: "6px",
    card: "8px",
    panel: "12px",
    pill: "9999px",
  },
  font: {
    family: 'Inter, -apple-system, system-ui, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, "SF Mono", Menlo, monospace',
    features: '"cv01", "ss03"',
  },
} as const
