import { normalizeHexColor } from "../categories/palette";

export const PROJECT_PALETTE = [
  "#5B9FE4",
  "#6DC9A0",
  "#9B85D6",
  "#52B3B3",
  "#7AB8E0",
  "#82C9C0",
  "#B094E0",
  "#5ECBA1",
] as const;

export const HUCHA_PROJECT_COLOR = "#6DC9A0";

type ProjectColorLike = {
  id?: string | null;
  color?: string | null;
  is_hucha?: boolean | null;
  created_at?: string | Date | null;
};

const toMillis = (value: string | Date | null | undefined): number => {
  if (!value) return 0;
  if (value instanceof Date) {
    const millis = value.getTime();
    return Number.isNaN(millis) ? 0 : millis;
  }
  const parsed = new Date(value);
  const millis = parsed.getTime();
  return Number.isNaN(millis) ? 0 : millis;
};

const normalizeProjectColor = (value: string | null | undefined): string | null =>
  normalizeHexColor(value);

/**
 * Picks the next project color using the defined palette.
 * Prefers the first unused color; if all are used, cycles by index.
 */
export function assignProjectColor(existingProjects: Array<{ color?: string | null }>): string {
  const used = new Set(
    existingProjects
      .map((project) => normalizeProjectColor(project.color))
      .filter((color): color is string => Boolean(color))
  );

  const available = PROJECT_PALETTE.find((color) => !used.has(color));
  if (available) return available;

  return PROJECT_PALETTE[existingProjects.length % PROJECT_PALETTE.length]!;
}

export function buildProjectColorMap(
  projects: ProjectColorLike[]
): Map<string, string> {
  const resolved = new Map<string, string>();
  const assigned: Array<{ color?: string | null }> = [];

  const ordered = [...projects]
    .filter((project) => !project.is_hucha)
    .sort((a, b) => {
      const byCreatedAt = toMillis(a.created_at) - toMillis(b.created_at);
      if (byCreatedAt !== 0) return byCreatedAt;
      return String(a.id ?? "").localeCompare(String(b.id ?? ""));
    });

  ordered.forEach((project) => {
    const normalized = normalizeProjectColor(project.color);
    const color = normalized ?? assignProjectColor(assigned);
    assigned.push({ color });
    if (project.id) {
      resolved.set(project.id, color);
    }
  });

  return resolved;
}

export function getProjectColor(
  project: Pick<ProjectColorLike, "id" | "color" | "is_hucha">,
  colorMap?: Map<string, string>
): string {
  if (project.is_hucha) return HUCHA_PROJECT_COLOR;

  const normalized = normalizeProjectColor(project.color);
  if (normalized) return normalized;

  if (project.id && colorMap?.has(project.id)) {
    return colorMap.get(project.id)!;
  }

  return PROJECT_PALETTE[0];
}
