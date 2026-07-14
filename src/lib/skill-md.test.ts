import { describe, it, expect } from "vitest";
import { stripFrontmatter } from "./skill-md";

describe("stripFrontmatter", () => {
  it("removes a leading YAML frontmatter block", () => {
    const md = `---
name: sample-skill
description: example skill
---

## Overview
Body content.`;
    expect(stripFrontmatter(md)).toBe("## Overview\nBody content.");
  });

  it("tolerates a leading BOM before the frontmatter", () => {
    const md = "﻿---\nname: x\n---\n## Overview\nBody";
    expect(stripFrontmatter(md)).toBe("## Overview\nBody");
  });

  it("leaves body-only markdown untouched (no frontmatter)", () => {
    const md = "## Overview\nBody only.";
    expect(stripFrontmatter(md)).toBe(md);
  });

  it("does not strip a `---` horizontal rule that isn't frontmatter", () => {
    const md = "## Overview\nfirst paragraph\n\n---\n\n## Next";
    expect(stripFrontmatter(md)).toBe(md);
  });
});
