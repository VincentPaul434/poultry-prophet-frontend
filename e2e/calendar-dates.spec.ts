import { expect, test } from "@playwright/test";
import { shiftCalendarDate, todayIso } from "../lib/format";

test("farm dates use Manila time around midnight", () => {
  expect(todayIso(new Date("2026-01-01T15:59:59Z"))).toBe("2026-01-01");
  expect(todayIso(new Date("2026-01-01T16:00:00Z"))).toBe("2026-01-02");
});

test("date ranges count calendar days across month and leap-year boundaries", () => {
  expect(shiftCalendarDate("2024-03-01", -1)).toBe("2024-02-29");
  expect(shiftCalendarDate("2026-01-01", -29)).toBe("2025-12-03");
});
