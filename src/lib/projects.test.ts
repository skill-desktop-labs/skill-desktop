import { describe, expect, it } from "vitest";
import {
  GLOBAL_SCOPE,
  makeProjectId,
  makeProjectScope,
  withGlobal,
} from "./projects";

describe("makeProjectId", () => {
  it("builds a stable id from the path", () => {
    expect(makeProjectId("/Users/me/dev/foo")).toBe("proj:/Users/me/dev/foo");
  });
});

describe("makeProjectScope", () => {
  it("uses the last path segment as the name", () => {
    expect(makeProjectScope("/Users/me/dev/foo")).toEqual({
      id: "proj:/Users/me/dev/foo",
      kind: "project",
      name: "foo",
      path: "/Users/me/dev/foo",
    });
  });

  it("handles a trailing slash correctly", () => {
    expect(makeProjectScope("/Users/me/dev/foo/").name).toBe("foo");
  });
});

describe("withGlobal", () => {
  it("always puts the global scope first", () => {
    const p = makeProjectScope("/Users/me/dev/foo");
    const result = withGlobal([p]);
    expect(result[0]).toBe(GLOBAL_SCOPE);
    expect(result[1]).toBe(p);
    expect(result).toHaveLength(2);
  });

  it("returns only the global scope when there are no projects", () => {
    expect(withGlobal([])).toEqual([GLOBAL_SCOPE]);
  });
});
