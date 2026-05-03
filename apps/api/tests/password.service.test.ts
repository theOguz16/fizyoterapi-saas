import { afterEach, describe, expect, it, vi } from "vitest";
import { getBcryptRounds } from "../services/password.service";

describe("password service", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns bounded bcrypt rounds from env", () => {
    vi.stubEnv("BCRYPT_ROUNDS", "9");
    expect(getBcryptRounds()).toBe(10);

    vi.stubEnv("BCRYPT_ROUNDS", "13");
    expect(getBcryptRounds()).toBe(13);

    vi.stubEnv("BCRYPT_ROUNDS", "30");
    expect(getBcryptRounds()).toBe(14);
  });

  it("falls back to default rounds for invalid env values", () => {
    vi.stubEnv("BCRYPT_ROUNDS", "not-a-number");
    expect(getBcryptRounds()).toBe(12);
  });
});
