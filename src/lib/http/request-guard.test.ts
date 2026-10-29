import { afterEach, describe, expect, it } from "vitest";
import { getAllowedOrigins, resetAllowedOriginsCache, verifySameOrigin } from "./request-guard";

describe("request-guard", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    resetAllowedOriginsCache();
  });

  it("accepts the current Vercel deployment origin when no site URL is configured", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.BOOKING_ALLOWED_ORIGINS;
    process.env.VERCEL_URL = "trouvetou-git-main-refontiq-dotcom.vercel.app";

    const origins = getAllowedOrigins();

    expect(origins.has("https://trouvetou-git-main-refontiq-dotcom.vercel.app")).toBe(true);
    expect(
      verifySameOrigin(new Headers({ origin: "https://trouvetou-git-main-refontiq-dotcom.vercel.app" }))
    ).toEqual({ ok: true });
  });

  it("rejects an unrelated origin", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.BOOKING_ALLOWED_ORIGINS;
    delete process.env.VERCEL_URL;

    expect(
      verifySameOrigin(new Headers({ origin: "https://evil.example" }))
    ).toMatchObject({ ok: false, reason: "origin_forbidden" });
  });
});
