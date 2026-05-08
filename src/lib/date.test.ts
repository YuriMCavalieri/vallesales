import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/constants";
import { parseDateValue, startOfLocalDay } from "@/lib/date";

describe("date-only handling", () => {
  it("parses YYYY-MM-DD as a local calendar date", () => {
    const parsed = parseDateValue("2026-05-10");

    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(4);
    expect(parsed?.getDate()).toBe(10);
  });

  it("normalizes date-only values to the start of the same local day", () => {
    const normalized = startOfLocalDay("2026-05-10");

    expect(normalized).not.toBeNull();
    expect(normalized?.getHours()).toBe(0);
    expect(normalized?.getMinutes()).toBe(0);
    expect(normalized?.getDate()).toBe(10);
  });

  it("formats date-only values without shifting to the previous day", () => {
    expect(formatDate("2026-05-10")).toBe("10/05/2026");
  });
});
