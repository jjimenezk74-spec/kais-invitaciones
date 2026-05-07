export type CanvasV3Theme = {
  id: "kais-luxury" | "romantic-garden" | "elegant-black" | "champagne-classic" | "floral-rose";
  name: string;
  description: string;
  colors: {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    muted: string;
  };
  fonts: {
    title: string;
    body: string;
  };
  sectionBackgrounds: Record<string, string>;
  textStyles: {
    title: Record<string, string | number>;
    subtitle: Record<string, string | number>;
    body: Record<string, string | number>;
  };
  buttonStyle: {
    background: string;
    color: string;
    border?: string;
    borderRadius: number;
  };
  decorationStyle: {
    background: string;
    border?: string;
    borderRadius: number;
    opacity: number;
  };
};

export const CANVAS_V3_THEMES: CanvasV3Theme[] = [
  {
    id: "kais-luxury",
    name: "KAIS Luxury",
    description: "Vino profundo, morado KAIS y acentos champagne.",
    colors: {
      background: "#0f0f17",
      surface: "#181322",
      primary: "#7c3aed",
      secondary: "#3d1535",
      accent: "#c8a96a",
      text: "#fff7ef",
      muted: "#c8c4f0"
    },
    fonts: {
      title: "'Playfair Display', Georgia, serif",
      body: "Inter, system-ui, sans-serif"
    },
    sectionBackgrounds: {
      hero: "linear-gradient(180deg,#1a0a18 0%,#3d1535 45%,#180a14 100%)",
      countdown: "linear-gradient(180deg,#180a14,#211129)",
      presentation: "linear-gradient(180deg,#211129,#160f1f)",
      messages: "linear-gradient(180deg,#160f1f,#241125)",
      details: "linear-gradient(180deg,#241125,#18121f)",
      church: "linear-gradient(180deg,#18121f,#20101c)",
      dresscode: "linear-gradient(180deg,#20101c,#17111c)",
      rsvp: "linear-gradient(180deg,#17111c,#241225)",
      footer: "linear-gradient(180deg,#241225,#0f0f17)"
    },
    textStyles: {
      title: { fontFamily: "'Playfair Display', Georgia, serif", color: "#fff7ef", textShadow: "0 4px 22px rgba(0,0,0,0.65)" },
      subtitle: { fontFamily: "'Playfair Display', Georgia, serif", color: "#f8d9a0", textShadow: "0 2px 12px rgba(0,0,0,0.55)" },
      body: { fontFamily: "Inter, system-ui, sans-serif", color: "#e8e0cc", textShadow: "0 2px 10px rgba(0,0,0,0.35)" }
    },
    buttonStyle: {
      background: "linear-gradient(135deg,#c8a96a,#9b6f2a)",
      color: "#1a0a18",
      borderRadius: 16
    },
    decorationStyle: {
      background: "radial-gradient(circle,#c8a96a66 0%,#7c3aed33 45%,transparent 74%)",
      border: "1px solid rgba(200,169,106,0.24)",
      borderRadius: 999,
      opacity: 0.86
    }
  },
  {
    id: "romantic-garden",
    name: "Romantic Garden",
    description: "Verdes suaves, rosas elegantes y luz de jardin.",
    colors: {
      background: "#f5efe6",
      surface: "#fffaf3",
      primary: "#8b1e2d",
      secondary: "#6e7f5f",
      accent: "#c8a96a",
      text: "#2b2b2b",
      muted: "#6f625c"
    },
    fonts: {
      title: "'Playfair Display', Georgia, serif",
      body: "Inter, system-ui, sans-serif"
    },
    sectionBackgrounds: {
      hero: "linear-gradient(180deg,#f7f0e6,#f3e5dd)",
      countdown: "linear-gradient(180deg,#f3e5dd,#eef2df)",
      presentation: "linear-gradient(180deg,#eef2df,#fffaf3)",
      messages: "linear-gradient(180deg,#fffaf3,#f7eadf)",
      details: "linear-gradient(180deg,#f7eadf,#eef2df)",
      church: "linear-gradient(180deg,#eef2df,#fffaf3)",
      dresscode: "linear-gradient(180deg,#fffaf3,#f6eadf)",
      rsvp: "linear-gradient(180deg,#f6eadf,#f2dfd7)",
      footer: "linear-gradient(180deg,#f2dfd7,#f7f0e6)"
    },
    textStyles: {
      title: { fontFamily: "'Playfair Display', Georgia, serif", color: "#8b1e2d", textShadow: "0 2px 12px rgba(139,30,45,0.18)" },
      subtitle: { fontFamily: "'Playfair Display', Georgia, serif", color: "#6e7f5f", textShadow: "none" },
      body: { fontFamily: "Inter, system-ui, sans-serif", color: "#2b2b2b", textShadow: "none" }
    },
    buttonStyle: {
      background: "linear-gradient(135deg,#8b1e2d,#b23a48)",
      color: "#fffaf3",
      borderRadius: 18
    },
    decorationStyle: {
      background: "radial-gradient(circle,#b23a4866 0%,#c8a96a40 46%,transparent 76%)",
      border: "1px solid rgba(139,30,45,0.20)",
      borderRadius: 999,
      opacity: 0.8
    }
  },
  {
    id: "elegant-black",
    name: "Elegant Black",
    description: "Negro grafito, champagne y contraste editorial.",
    colors: {
      background: "#060608",
      surface: "#111114",
      primary: "#d6b875",
      secondary: "#1d1d24",
      accent: "#f2d991",
      text: "#f8f3e7",
      muted: "#b7ad9c"
    },
    fonts: {
      title: "'Playfair Display', Georgia, serif",
      body: "Inter, system-ui, sans-serif"
    },
    sectionBackgrounds: {
      hero: "linear-gradient(180deg,#050506,#151318 58%,#050506)",
      countdown: "linear-gradient(180deg,#050506,#101014)",
      presentation: "linear-gradient(180deg,#101014,#18151a)",
      messages: "linear-gradient(180deg,#18151a,#0d0d10)",
      details: "linear-gradient(180deg,#0d0d10,#17131a)",
      church: "linear-gradient(180deg,#17131a,#0f0f12)",
      dresscode: "linear-gradient(180deg,#0f0f12,#151216)",
      rsvp: "linear-gradient(180deg,#151216,#08080a)",
      footer: "linear-gradient(180deg,#08080a,#030304)"
    },
    textStyles: {
      title: { fontFamily: "'Playfair Display', Georgia, serif", color: "#f8f3e7", textShadow: "0 4px 24px rgba(214,184,117,0.20)" },
      subtitle: { fontFamily: "'Playfair Display', Georgia, serif", color: "#d6b875", textShadow: "0 2px 14px rgba(0,0,0,0.65)" },
      body: { fontFamily: "Inter, system-ui, sans-serif", color: "#ddd3c0", textShadow: "0 2px 10px rgba(0,0,0,0.45)" }
    },
    buttonStyle: {
      background: "linear-gradient(135deg,#f2d991,#a77e31)",
      color: "#070707",
      borderRadius: 14
    },
    decorationStyle: {
      background: "radial-gradient(circle,#f2d99180 0%,#d6b87530 42%,transparent 72%)",
      border: "1px solid rgba(242,217,145,0.25)",
      borderRadius: 999,
      opacity: 0.72
    }
  },
  {
    id: "champagne-classic",
    name: "Champagne Classic",
    description: "Crema, dorado suave y tradicion luminosa.",
    colors: {
      background: "#f7f1e6",
      surface: "#fffbf3",
      primary: "#9b6f2a",
      secondary: "#e7d6b5",
      accent: "#c8a96a",
      text: "#302820",
      muted: "#7a6d5f"
    },
    fonts: {
      title: "'Playfair Display', Georgia, serif",
      body: "Inter, system-ui, sans-serif"
    },
    sectionBackgrounds: {
      hero: "linear-gradient(180deg,#fff8ec,#ead7b5)",
      countdown: "linear-gradient(180deg,#ead7b5,#fffaf1)",
      presentation: "linear-gradient(180deg,#fffaf1,#f4ead8)",
      messages: "linear-gradient(180deg,#f4ead8,#fffaf3)",
      details: "linear-gradient(180deg,#fffaf3,#efe1c7)",
      church: "linear-gradient(180deg,#efe1c7,#fffaf3)",
      dresscode: "linear-gradient(180deg,#fffaf3,#f2e2c3)",
      rsvp: "linear-gradient(180deg,#f2e2c3,#fff6e8)",
      footer: "linear-gradient(180deg,#fff6e8,#f7f1e6)"
    },
    textStyles: {
      title: { fontFamily: "'Playfair Display', Georgia, serif", color: "#8f6628", textShadow: "0 2px 12px rgba(155,111,42,0.18)" },
      subtitle: { fontFamily: "'Playfair Display', Georgia, serif", color: "#9b6f2a", textShadow: "none" },
      body: { fontFamily: "Inter, system-ui, sans-serif", color: "#302820", textShadow: "none" }
    },
    buttonStyle: {
      background: "linear-gradient(135deg,#d9bd7c,#9b6f2a)",
      color: "#24180b",
      borderRadius: 16
    },
    decorationStyle: {
      background: "radial-gradient(circle,#d9bd7c78 0%,#fff6d230 50%,transparent 76%)",
      border: "1px solid rgba(155,111,42,0.20)",
      borderRadius: 999,
      opacity: 0.78
    }
  },
  {
    id: "floral-rose",
    name: "Floral Rose",
    description: "Rosas rojas, papel calido y acentos romanticos.",
    colors: {
      background: "#f6f1e9",
      surface: "#fffaf5",
      primary: "#8b1e2d",
      secondary: "#b23a48",
      accent: "#c8a96a",
      text: "#2c2c2c",
      muted: "#6f625c"
    },
    fonts: {
      title: "'Playfair Display', Georgia, serif",
      body: "Inter, system-ui, sans-serif"
    },
    sectionBackgrounds: {
      hero: "linear-gradient(180deg,#f6f1e9,#f1ded7)",
      countdown: "linear-gradient(180deg,#f1ded7,#fffaf5)",
      presentation: "linear-gradient(180deg,#fffaf5,#f7ebe2)",
      messages: "linear-gradient(180deg,#f7ebe2,#fffaf5)",
      details: "linear-gradient(180deg,#fffaf5,#f1ded7)",
      church: "linear-gradient(180deg,#f1ded7,#fffaf5)",
      dresscode: "linear-gradient(180deg,#fffaf5,#f7e8df)",
      rsvp: "linear-gradient(180deg,#f7e8df,#f1dad2)",
      footer: "linear-gradient(180deg,#f1dad2,#f6f1e9)"
    },
    textStyles: {
      title: { fontFamily: "'Playfair Display', Georgia, serif", color: "#8b1e2d", textShadow: "0 2px 14px rgba(139,30,45,0.20)" },
      subtitle: { fontFamily: "'Playfair Display', Georgia, serif", color: "#b23a48", textShadow: "none" },
      body: { fontFamily: "Inter, system-ui, sans-serif", color: "#2c2c2c", textShadow: "none" }
    },
    buttonStyle: {
      background: "linear-gradient(135deg,#b23a48,#7a1f2b)",
      color: "#fffaf5",
      borderRadius: 18
    },
    decorationStyle: {
      background: "radial-gradient(circle,#b23a486e 0%,#e8d8b54d 48%,transparent 78%)",
      border: "1px solid rgba(139,30,45,0.22)",
      borderRadius: 999,
      opacity: 0.82
    }
  }
];

export const DEFAULT_CANVAS_V3_THEME_ID: CanvasV3Theme["id"] = "kais-luxury";

export function getCanvasV3Theme(themeId?: string | null) {
  return CANVAS_V3_THEMES.find((theme) => theme.id === themeId) ?? CANVAS_V3_THEMES[0];
}
