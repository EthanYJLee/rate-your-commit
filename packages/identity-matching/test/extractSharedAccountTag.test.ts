import { describe, expect, it } from "vitest";
import { extractSharedAccountTag } from "../src/extractSharedAccountTag";

describe("extractSharedAccountTag", () => {
  it("extracts a tag that's the entire commit message", () => {
    expect(extractSharedAccountTag("[개발자T]")).toBe("개발자T");
  });

  it("extracts a tag from within a longer message", () => {
    expect(extractSharedAccountTag("[개발자T] fixed the null check")).toBe("개발자T");
  });

  it("returns null when there's no bracket group at all", () => {
    expect(extractSharedAccountTag("fix: null check")).toBeNull();
  });

  it("returns null for an empty bracket group", () => {
    expect(extractSharedAccountTag("[] fixed something")).toBeNull();
  });

  it("uses only the first bracket group when multiple appear", () => {
    expect(extractSharedAccountTag("[개발자T] see also [DEFECT-123]")).toBe("개발자T");
  });

  it("trims surrounding whitespace inside the brackets", () => {
    expect(extractSharedAccountTag("[  개발자T  ]")).toBe("개발자T");
  });
});
