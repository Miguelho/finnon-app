import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROJECT_PALETTE,
  HUCHA_PROJECT_COLOR,
  assignProjectColor,
  buildProjectColorMap,
  getProjectColor,
} from "./palette";

test("assignProjectColor returns the first free palette color", () => {
  const color = assignProjectColor([
    { color: PROJECT_PALETTE[0] },
    { color: PROJECT_PALETTE[2] },
  ]);

  assert.equal(color, PROJECT_PALETTE[1]);
});

test("assignProjectColor cycles when all colors are used", () => {
  const existing = PROJECT_PALETTE.map((color) => ({ color }));
  const color = assignProjectColor(existing);
  assert.equal(color, PROJECT_PALETTE[0]);
});

test("buildProjectColorMap assigns fallback colors in creation order", () => {
  const map = buildProjectColorMap([
    { id: "c", color: null, created_at: "2026-03-01T00:00:00.000Z" },
    { id: "a", color: null, created_at: "2026-01-01T00:00:00.000Z" },
    { id: "b", color: PROJECT_PALETTE[4], created_at: "2026-02-01T00:00:00.000Z" },
  ]);

  assert.equal(map.get("a"), PROJECT_PALETTE[0]);
  assert.equal(map.get("b"), PROJECT_PALETTE[4]);
  assert.equal(map.get("c"), PROJECT_PALETTE[1]);
});

test("getProjectColor returns fixed mint for hucha", () => {
  const color = getProjectColor({ id: "h", is_hucha: true, color: null });
  assert.equal(color, HUCHA_PROJECT_COLOR);
});
