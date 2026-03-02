import { cn } from "@/lib/utils";

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
