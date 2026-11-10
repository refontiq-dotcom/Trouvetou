import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildPartnerBookingHeaders,
  getPartnerBookingSecret,
} from "./partner-secret";

afterEach(() => vi.unstubAllEnvs());

describe("partner booking secrets", () => {
  it("resolves a provider-scoped secret from its normalized name", () => {
    vi.stubEnv("TROUVETOU_BOOKING_SECRET_SCHOOLY", "schooly-secret");
    expect(getPartnerBookingSecret("Schooly")).toBe("schooly-secret");
  });

  it("normalizes accented and spaced provider names", () => {
    vi.stubEnv("TROUVETOU_BOOKING_SECRET_SEJOURA", "sejoura-secret");
    expect(getPartnerBookingSecret("Séjoura")).toBe("sejoura-secret");
  });

  it("keeps the legacy Sejoura secret as a compatibility fallback", () => {
    vi.stubEnv("TROUVETOU_BOOKING_SHARED_SECRET", "legacy-secret");
    expect(getPartnerBookingSecret("Sejoura")).toBe("legacy-secret");
  });

  it("does not reuse another provider's secret", () => {
    vi.stubEnv("TROUVETOU_BOOKING_SECRET_SCHOOLY", "schooly-secret");
    expect(getPartnerBookingSecret("FuturePlatform")).toBeNull();
  });

  it("uses the standard partner authentication header", () => {
    expect(buildPartnerBookingHeaders("secret")).toEqual({
      "Content-Type": "application/json",
      "x-trouvetou-booking-secret": "secret",
    });
  });
});
