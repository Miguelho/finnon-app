import assert from "node:assert/strict";
import { test } from "node:test";
import type { Project } from "../projects/types";
import {
  buildHomeProjectPreviews,
  getProjectContributionTotals,
} from "./responsive-layout";

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

test("getProjectContributionTotals sums amount_base_minor by project_id", () => {
  const totals = getProjectContributionTotals([
    { project_id: "project-1", amount_base_minor: "1200" },
    { project_id: "project-1", amount_base_minor: 300 },
    { project_id: "project-2", amount_base_minor: "450" },
    { project_id: null, amount_base_minor: "999" },
  ]);

  assert.equal(totals.get("project-1"), 1500n);
  assert.equal(totals.get("project-2"), 450n);
  assert.equal(totals.has("missing"), false);
});

test("buildHomeProjectPreviews orders by priority and limits to top projects", () => {
  const previews = buildHomeProjectPreviews({
    projects: [
      baseProject({ id: "p-3", name: "Third", priority: 3 }),
      baseProject({ id: "p-1", name: "First", priority: 1 }),
      baseProject({ id: "p-2", name: "Second", priority: 2 }),
      baseProject({ id: "p-4", name: "Fourth", priority: 4 }),
    ],
    contributionRows: [],
    limit: 3,
  });

  assert.deepEqual(
    previews.map((preview) => preview.id),
    ["p-1", "p-2", "p-3"]
  );
});

test("buildHomeProjectPreviews clamps progress for empty and overfunded goals", () => {
  const previews = buildHomeProjectPreviews({
    projects: [
      baseProject({
        id: "zero-goal",
        target_amount_base_minor: "0",
        monthly_commitment_base_minor: "1000",
        priority: 1,
      }),
      baseProject({
        id: "overfunded",
        target_amount_base_minor: "1000",
        monthly_commitment_base_minor: "1000",
        priority: 2,
      }),
    ],
    contributionRows: [
      { project_id: "zero-goal", amount_base_minor: "2500" },
      { project_id: "overfunded", amount_base_minor: "1200" },
    ],
  });

  assert.equal(previews[0]?.progressRatio, 0);
  assert.equal(previews[1]?.progressRatio, 1);
});

test("buildHomeProjectPreviews derives ETA from computeProjectProgress using fundedMinor", () => {
  const now = new Date("2026-03-10T00:00:00.000Z");
  const [preview] = buildHomeProjectPreviews({
    projects: [
      baseProject({
        id: "eta-project",
        target_amount_base_minor: "600000",
        monthly_commitment_base_minor: "35000",
      }),
    ],
    contributionRows: [{ project_id: "eta-project", amount_base_minor: "185000" }],
    now,
  });

  assert.equal(preview?.totalContributed, 185000n);
  assert.equal(preview?.estimatedCompletion?.getFullYear(), 2027);
  assert.equal(preview?.estimatedCompletion?.getMonth(), 2);
});
