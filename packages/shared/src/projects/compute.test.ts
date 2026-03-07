import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeGoalComposition,
  computePendingMonthCloseKeys,
  computePendingMonthCloseKeysFromMonthCloses,
  computeProjectMonthlyAllocation,
  computeProjectProgress,
  distributeProjectSurplusProportionally,
} from "./compute";
import type { Project, ProjectContribution } from "./types";

test("computeProjectProgress derives saved amount and ETA", () => {
  const project: Project = {
    id: "project-1",
    account_id: "acc-1",
    name: "Eurodisney",
    emoji: "🏰",
    target_amount_base_minor: "600000",
    monthly_commitment_base_minor: "35000",
    priority: 1,
    status: "active",
  };

  const contributions: ProjectContribution[] = [
    {
      id: "c-1",
      project_id: "project-1",
      period: "2026-01-01",
      actual_amount_base_minor: "100000",
      confirmed: true,
    },
    {
      id: "c-2",
      project_id: "project-1",
      period: "2026-02-01",
      actual_amount_base_minor: "85000",
      confirmed: true,
    },
    {
      id: "c-3",
      project_id: "project-1",
      period: "2026-03-01",
      actual_amount_base_minor: "30000",
      confirmed: false,
    },
  ];

  const progress = computeProjectProgress({
    project,
    contributions,
    now: new Date(2026, 1, 10),
  });

  assert.equal(progress.savedMinor, 185000n);
  assert.equal(progress.monthlySavedMinor, 185000n);
  assert.equal(progress.extraSavedMinor, 0n);
  assert.equal(progress.remainingMinor, 415000n);
  assert.equal(progress.monthsLeft, 12);
  assert.ok(progress.estimatedCompletionDate);
  assert.equal(progress.estimatedCompletionDate?.getFullYear(), 2027);
  assert.equal(progress.estimatedCompletionDate?.getMonth(), 1);
});

test("computeProjectProgress tracks spending separately from funded progress", () => {
  const project: Project = {
    id: "project-1",
    account_id: "acc-1",
    name: "Eurodisney",
    emoji: "🏰",
    target_amount_base_minor: "600000",
    monthly_commitment_base_minor: "35000",
    priority: 1,
    status: "active",
  };

  const contributions: ProjectContribution[] = [
    {
      id: "c-1",
      project_id: "project-1",
      period: "2026-01-01",
      actual_amount_base_minor: "100000",
      confirmed: true,
    },
  ];

  const progress = computeProjectProgress({
    project,
    contributions,
    spentMinor: "50000",
    now: new Date(2026, 1, 10),
  });

  assert.equal(progress.monthlySavedMinor, 100000n);
  assert.equal(progress.savedMinor, 100000n);
  assert.equal(progress.spentMinor, 50000n);
  assert.equal(progress.remainingMinor, 500000n);
  assert.equal(progress.monthsLeft, 15);
});

test("computeProjectMonthlyAllocation respects strict priority in deficit", () => {
  const result = computeProjectMonthlyAllocation({
    projects: [
      { projectId: "eurodisney", priority: 1, commitmentMinor: 35000 },
      { projectId: "laptop", priority: 2, commitmentMinor: 20000 },
    ],
    actualSavedMinor: 40000,
  });

  assert.equal(result.totalCommittedMinor, 55000n);
  assert.equal(result.deficitMinor, 15000n);
  assert.equal(result.allocations[0]?.allocatedMinor, 35000n);
  assert.equal(result.allocations[1]?.allocatedMinor, 5000n);
});

test("computeProjectMonthlyAllocation uses proportional split within same priority", () => {
  const result = computeProjectMonthlyAllocation({
    projects: [
      { projectId: "eurodisney", priority: 1, commitmentMinor: 35000 },
      { projectId: "laptop", priority: 1, commitmentMinor: 20000 },
    ],
    actualSavedMinor: 40000,
  });

  assert.equal(result.deficitMinor, 15000n);
  assert.equal(result.allocations[0]?.allocatedMinor, 25455n);
  assert.equal(result.allocations[1]?.allocatedMinor, 14545n);
});

test("computeProjectMonthlyAllocation leaves surplus unassigned", () => {
  const result = computeProjectMonthlyAllocation({
    projects: [
      { projectId: "eurodisney", priority: 1, commitmentMinor: 35000 },
      { projectId: "laptop", priority: 2, commitmentMinor: 20000 },
    ],
    actualSavedMinor: 80000,
  });

  assert.equal(result.surplusMinor, 25000n);
  assert.equal(result.allocations[0]?.allocatedMinor, 35000n);
  assert.equal(result.allocations[1]?.allocatedMinor, 20000n);

  const surplusDistribution = distributeProjectSurplusProportionally({
    projects: [
      { projectId: "eurodisney", priority: 1, commitmentMinor: 35000 },
      { projectId: "laptop", priority: 2, commitmentMinor: 20000 },
    ],
    surplusMinor: result.surplusMinor,
  });

  assert.equal(surplusDistribution[0]?.allocatedSurplusMinor, 15909n);
  assert.equal(surplusDistribution[1]?.allocatedSurplusMinor, 9091n);
});

test("computeGoalComposition enforces projects as minimum total", () => {
  const composition = computeGoalComposition({
    totalGoalMinor: 50000,
    projectsCommitmentMinor: 55000,
  });

  assert.equal(composition.fromProjectsMinor, 55000n);
  assert.equal(composition.totalMinor, 55000n);
  assert.equal(composition.manualMinor, 0n);
});

test("computePendingMonthCloseKeys returns all pending months in descending order", () => {
  const pending = computePendingMonthCloseKeys({
    commitmentProjects: [
      { projectId: "p1", createdAt: "2026-01-12" },
      { projectId: "p2", createdAt: "2026-03-02" },
    ],
    confirmedContributions: [
      { projectId: "p1", period: "2026-01-01" },
      { projectId: "p1", period: "2026-03-01" },
      { projectId: "p2", period: "2026-03-01" },
      { projectId: "p1", period: "2026-04-01" },
      { projectId: "p2", period: "2026-04-01" },
      { projectId: "p1", period: "2026-06-01" },
    ],
    currentMonthKey: "2026-07",
  });

  assert.deepEqual(pending, ["2026-06", "2026-05", "2026-02"]);
});

test("computePendingMonthCloseKeys ignores future project starts", () => {
  const pending = computePendingMonthCloseKeys({
    commitmentProjects: [{ projectId: "future-project", createdAt: "2026-03-01" }],
    confirmedContributions: [],
    currentMonthKey: "2026-03",
  });

  assert.deepEqual(pending, []);
});

test("computePendingMonthCloseKeysFromMonthCloses uses month-level closes", () => {
  const pending = computePendingMonthCloseKeysFromMonthCloses({
    commitmentProjects: [
      { projectId: "p1", createdAt: "2026-01-12" },
      { projectId: "p2", createdAt: "2026-03-02" },
    ],
    closedMonths: [{ period: "2026-01-01" }, { period: "2026-03-01" }],
    currentMonthKey: "2026-05",
  });

  assert.deepEqual(pending, ["2026-04", "2026-02"]);
});
