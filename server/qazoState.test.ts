import { describe, expect, it } from "vitest";
import { createDefaultQazoState, qazoAppStateSchema } from "../shared/qazo";
import { targetForLocalDay } from "../client/src/lib/qazoState";

describe("Qazo app state compatibility", () => {
  it("accepts prior saved data with no target history", () => {
    const { targetHistory: _targetHistory, ...previousState } = createDefaultQazoState();
    const parsed = qazoAppStateSchema.parse(previousState);
    expect(parsed.targetHistory).toEqual([]);
  });

  it("uses the plan that was effective on each historical date", () => {
    const state = {
      ...createDefaultQazoState(),
      target: 10,
      targetHistory: [
        { effectiveDate: "2026-08-01", target: 2 },
        { effectiveDate: "2026-08-15", target: 5 },
        { effectiveDate: "2026-09-01", target: 10 },
      ],
    };

    expect(targetForLocalDay(state, "2026-08-10")).toBe(2);
    expect(targetForLocalDay(state, "2026-08-20")).toBe(5);
    expect(targetForLocalDay(state, "2026-09-02")).toBe(10);
  });
});
