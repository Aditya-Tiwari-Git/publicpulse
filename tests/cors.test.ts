import { describe, expect, it } from "vitest";
import {
  corsHeaders,
  parseAllowedOrigins,
} from "../supabase/functions/_shared/cors.ts";

describe("Edge Function CORS", () => {
  it("normalizes the deployed trailing-slash configuration to the browser origin", () => {
    const allowed = parseAllowedOrigins("https://publicpulse.pages.dev/");
    const headers = corsHeaders("https://publicpulse.pages.dev", allowed);
    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "https://publicpulse.pages.dev",
    );
    expect(headers["Access-Control-Allow-Methods"]).toContain("OPTIONS");
    expect(headers["Access-Control-Allow-Headers"]).toContain("authorization");
  });
  it("trims and deduplicates multiple origins and preserves local ports", () => {
    expect(
      parseAllowedOrigins(
        " https://publicpulse.pages.dev/ ,http://localhost:5186/,https://publicpulse.pages.dev ",
      ),
    ).toEqual(["https://publicpulse.pages.dev", "http://localhost:5186"]);
  });
  it("does not reflect unapproved or lookalike origins", () => {
    const allowed = parseAllowedOrigins("https://publicpulse.pages.dev/");
    for (const origin of [
      "https://publicpulse.pages.dev.evil.example",
      "http://publicpulse.pages.dev",
      "null",
    ]) {
      expect(corsHeaders(origin, allowed)).not.toHaveProperty(
        "Access-Control-Allow-Origin",
      );
    }
  });
  it("rejects invalid configuration rather than permitting arbitrary origins", () => {
    for (const value of [
      "*",
      "null",
      "file:///tmp/page.html",
      "https://user:password@example.com",
    ]) {
      expect(() => parseAllowedOrigins(value)).toThrow();
    }
  });
});
