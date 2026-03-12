import { cn, possessiveTitle } from "@/lib/utils";

describe("cn()", () => {
  it("returns an empty string with no arguments", () => {
    expect(cn()).toBe("");
  });

  it("joins class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("ignores falsy values", () => {
    expect(cn("foo", false, undefined, null, "bar")).toBe("foo bar");
  });

  it("merges conflicting Tailwind classes, keeping the last one", () => {
    expect(cn("p-4", "p-8")).toBe("p-8");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("handles conditional classes via objects", () => {
    expect(cn({ "font-bold": true, italic: false })).toBe("font-bold");
  });
});

describe("possessiveTitle()", () => {
  it("appends 's to a regular name", () => {
    expect(possessiveTitle("Jon")).toBe("Jon's Weekly Planner");
  });

  it("appends only an apostrophe when name ends in s", () => {
    expect(possessiveTitle("James")).toBe("James' Weekly Planner");
  });

  it("handles uppercase S at end of name", () => {
    expect(possessiveTitle("Thomas")).toBe("Thomas' Weekly Planner");
  });

  it("works with single-character names", () => {
    expect(possessiveTitle("A")).toBe("A's Weekly Planner");
  });

  it("handles name ending in lowercase s", () => {
    expect(possessiveTitle("Francis")).toBe("Francis' Weekly Planner");
  });
});
