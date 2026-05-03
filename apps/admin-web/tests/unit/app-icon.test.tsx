import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppIcon, renderLegacyIconNode } from "@/components/ui/app-icon";

describe("AppIcon", () => {
  it("renders mapped legacy icons with lucide classes", () => {
    const markup = renderToStaticMarkup(<AppIcon icon="fa-users text-sky-600" />);

    expect(markup).toContain("lucide-users");
    expect(markup).not.toContain("fa-users");
    expect(markup).toContain("text-sky-600");
  });

  it("falls back to alert icon for unknown legacy tokens", () => {
    const markup = renderToStaticMarkup(<AppIcon icon="fa-not-real" />);

    expect(markup).toContain("lucide-circle-alert");
  });

  it("upgrades legacy i nodes into svg icons", () => {
    const markup = renderToStaticMarkup(
      <div>{renderLegacyIconNode(<i className="fa-user-nurse text-emerald-600" />)}</div>
    );

    expect(markup).toContain("lucide-stethoscope");
    expect(markup).toContain("text-emerald-600");
  });
});
