import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Badge, Button, IssueRow, cn } from "../src/index.js";

describe("@wtf/ui", () => {
  it("склеивает className значения", () => {
    expect(cn("a", false, undefined, "b")).toBe("a b");
  });

  it("рендерит кнопку с вариантом", () => {
    const html = renderToStaticMarkup(<Button variant="secondary">Save</Button>);

    expect(html).toContain("Save");
    expect(html).toContain("border");
  });

  it("рендерит badge", () => {
    const html = renderToStaticMarkup(<Badge tone="green">done</Badge>);

    expect(html).toContain("done");
    expect(html).toContain("emerald");
  });

  it("рендерит строку issue", () => {
    const html = renderToStaticMarkup(
      <IssueRow issueKey="PF-1" title="Implement domain" status="todo" priority="high" />,
    );

    expect(html).toContain("PF-1");
    expect(html).toContain("Implement domain");
  });
});
