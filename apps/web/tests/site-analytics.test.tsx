import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/script", () => ({
  default: ({ id, src, children }: { id?: string; src?: string; children?: React.ReactNode }) => (
    <script data-testid={id || "external-script"} id={id} src={src}>{children}</script>
  ),
}));

describe("analytics consent", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_GA_ID", "G-TEST123");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
  });

  it("does not load analytics until the visitor accepts", async () => {
    const { SiteAnalytics } = await import("@/components/site-analytics");
    const user = userEvent.setup();
    render(<SiteAnalytics />);

    const dialog = await screen.findByRole("dialog", { name: "Analitik tercihleri" });
    expect(dialog).toBeInTheDocument();
    expect(screen.queryByTestId("fizyoflow-ga4")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Kabul Et" }));

    expect(window.localStorage.getItem("fizyoflow_analytics_consent")).toBe("granted");
    expect(await screen.findByTestId("fizyoflow-ga4")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Analitik tercihleri" })).not.toBeInTheDocument();
  });

  it("persists decline and keeps analytics disabled", async () => {
    const { SiteAnalytics } = await import("@/components/site-analytics");
    const user = userEvent.setup();
    render(<SiteAnalytics />);

    await user.click(await screen.findByRole("button", { name: "Reddet" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Analitik tercihleri" })).not.toBeInTheDocument());
    expect(window.localStorage.getItem("fizyoflow_analytics_consent")).toBe("declined");
    expect(screen.queryByTestId("fizyoflow-ga4")).not.toBeInTheDocument();
  });
});
