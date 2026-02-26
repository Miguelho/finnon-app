import assert from "node:assert/strict";
import { test } from "node:test";
import type { Project } from "../projects/types";
import { getProjectWidgetState } from "./project-widget";

const baseProject = (overrides: Partial<Project>): Project => ({
  id: "project-id",
  account_id: "account-id",
  name: "Project",
  emoji: "🎯",
  target_amount_base_minor: "100000",
  monthly_commitment_base_minor: "10000",
  priority: 1,
  status: "active",
  created_at: "2026-01-01T10:00:00.000Z",
  updated_at: "2026-01-01T10:00:00.000Z",
  ...overrides,
});

test("getProjectWidgetState returns empty when there are no active/completed projects", () => {
  const state = getProjectWidgetState([]);
  assert.deepEqual(state, { state: "empty" });
});

test("getProjectWidgetState returns all_done when all projects are completed", () => {
  const state = getProjectWidgetState([
    baseProject({
      id: "completed-1",
      status: "completed",
      updated_at: "2026-02-10T12:00:00.000Z",
    }),
    baseProject({
      id: "completed-2",
      status: "completed",
      updated_at: "2026-02-20T12:00:00.000Z",
    }),
  ]);

  assert.equal(state.state, "all_done");
  assert.equal(state.project?.id, "completed-2");
});

test("getProjectWidgetState prioritizes recently completed celebrations", () => {
  const now = new Date("2026-02-25T12:00:00.000Z");
  const state = getProjectWidgetState(
    [
      baseProject({
        id: "active-1",
        status: "active",
        priority: 1,
      }),
      baseProject({
        id: "completed-recent",
        status: "completed",
        updated_at: "2026-02-22T12:00:00.000Z",
      }),
    ],
    now
  );

  assert.equal(state.state, "completed");
  assert.equal(state.project.id, "completed-recent");
});

test("getProjectWidgetState returns highest priority active project", () => {
  const now = new Date("2026-02-25T12:00:00.000Z");
  const state = getProjectWidgetState(
    [
      baseProject({
        id: "active-priority-2",
        status: "active",
        priority: 2,
      }),
      baseProject({
        id: "active-priority-1",
        status: "active",
        priority: 1,
      }),
      baseProject({
        id: "completed-old",
        status: "completed",
        updated_at: "2026-02-01T12:00:00.000Z",
      }),
    ],
    now
  );

  assert.equal(state.state, "active");
  assert.equal(state.project.id, "active-priority-1");
});
