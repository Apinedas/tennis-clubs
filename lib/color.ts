const HEX_RE = /^#([0-9a-fA-F]{6})$/;

// Darkens a hex color by scaling each channel — used to derive a hover
// shade from a club's brand_color without storing a second value.
export function darken(hex: string, factor = 0.85): string {
  const match = HEX_RE.exec(hex);
  if (!match) return hex;

  const channel = (offset: number) => {
    const value = Math.round(parseInt(match[1].slice(offset, offset + 2), 16) * factor);
    return Math.max(0, Math.min(255, value))
      .toString(16)
      .padStart(2, "0");
  };

  return `#${channel(0)}${channel(2)}${channel(4)}`;
}
