import { describe, expect, it } from "vitest";
import { GET } from "@/app/.well-known/apple-app-site-association/route";

describe("Apple app site association", () => {
  it("routes branded clinic join links directly to the iOS app", async () => {
    const response = GET();

    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      applinks: {
        apps: [],
        details: [
          {
            appID: "75HL8KU3H9.com.fizyoflow.mobile",
            paths: ["/join/*"],
          },
        ],
      },
    });
  });
});
