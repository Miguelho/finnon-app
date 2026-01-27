export const withAlpha = (color: string, alpha: number) => {
  if (!color.startsWith("#")) return color;
  const trimmed = color.replace("#", "");
  const size = trimmed.length === 3 ? 1 : 2;
  const normalize = (value: string) =>
    size === 1 ? Number.parseInt(value + value, 16) : Number.parseInt(value, 16);
  const values = trimmed.match(new RegExp(`.{1,${size}}`, "g"));
  if (!values || values.length < 3) return color;
  const [r, g, b] = values.map(normalize);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
