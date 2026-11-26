import { describe, expect, it } from "vitest";
import { boardLimit, buildBoardFilter } from "../src/lib/search";

describe("board query", () => {
  it("defaults to 12 items when limit is missing or empty", () => {
    expect(boardLimit(null)).toBe(12);
    expect(boardLimit(undefined)).toBe(12);
    expect(boardLimit("")).toBe(12);
    expect(boardLimit("nope")).toBe(12);
  });

  it("clamps an explicit limit between 1 and 48", () => {
    expect(boardLimit("1")).toBe(1);
    expect(boardLimit("12")).toBe(12);
    expect(boardLimit("500")).toBe(48);
    expect(boardLimit("-3")).toBe(1);
    expect(boardLimit("4.9")).toBe(4);
  });

  it("hides disposed items unless a state is requested", () => {
    expect(buildBoardFilter({})).toMatchObject({
      status: { $in: expect.arrayContaining(["open", "claim_pending", "in_custody"]) },
    });
    expect(buildBoardFilter({ state: "all" }).status).toBeUndefined();
    expect(buildBoardFilter({ state: "expired" }).status).toBe("expired");
  });
});
