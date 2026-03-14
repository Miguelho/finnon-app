import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getProjectReserveTransferDeltaMinor,
  getProjectReserveTransferTotalsMap,
  getReserveContainerBalanceMinor,
  getReserveContainerStats,
} from "./compute.ts";
import type { MonthCloseAllocation, ReserveTransfer } from "./types.ts";

test("project reserve transfer deltas respect direction", () => {
  const transferIn: ReserveTransfer = {
    id: "in",
    account_id: "account",
    source_reserve_container_id: "reserve",
    destination_project_id: "project",
    amount_base_minor: 500,
    direction: "reserve_to_project",
  };
  const transferOut: ReserveTransfer = {
    ...transferIn,
    id: "out",
    amount_base_minor: 200,
    direction: "project_to_reserve",
  };

  assert.equal(getProjectReserveTransferDeltaMinor(transferIn), 500n);
  assert.equal(getProjectReserveTransferDeltaMinor(transferOut), -200n);
});

test("project reserve transfer totals and reserve balance include returns", () => {
  const closeAllocations: MonthCloseAllocation[] = [
    {
      id: "allocation",
      month_close_id: "close-1",
      account_id: "account",
      destination_type: "reserve_container",
      reserve_container_id: "reserve",
      amount_base_minor: 1000,
      created_at: "2026-03-01T00:00:00.000Z",
    },
  ];
  const reserveTransfers: ReserveTransfer[] = [
    {
      id: "transfer-in",
      account_id: "account",
      source_reserve_container_id: "reserve",
      destination_project_id: "project-a",
      amount_base_minor: 300,
      direction: "reserve_to_project",
      created_at: "2026-03-05T00:00:00.000Z",
    },
    {
      id: "transfer-out",
      account_id: "account",
      source_reserve_container_id: "reserve",
      destination_project_id: "project-a",
      amount_base_minor: 120,
      direction: "project_to_reserve",
      created_at: "2026-03-10T00:00:00.000Z",
    },
  ];

  const byProject = getProjectReserveTransferTotalsMap(reserveTransfers);
  assert.equal(byProject.get("project-a"), 180n);

  const reserveBalanceMinor = getReserveContainerBalanceMinor({
    reserveContainerId: "reserve",
    closeAllocations,
    reserveTransfers,
  });
  assert.equal(reserveBalanceMinor, 820n);

  const stats = getReserveContainerStats({
    reserveContainerId: "reserve",
    closeAllocations,
    reserveTransfers,
    currentPeriod: "2026-03",
  });
  assert.equal(stats.accumulatedMinor, 820n);
  assert.equal(stats.currentMonthContributionMinor, 820n);
});
