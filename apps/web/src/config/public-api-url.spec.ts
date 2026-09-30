import { describe, expect, it } from "vitest";
import { resolvePublicApiUrl } from "./public-api-url";

describe("public API configuration", () => {
  it("keeps the local development fallback", () => {
    expect(resolvePublicApiUrl(undefined, "development")).toBe(
      "http://localhost:3001/api/v1",
    );
  });
  it("normalizes the production API prefix", () => {
    expect(
      resolvePublicApiUrl("https://api.example.com/api/v1/", "production"),
    ).toBe("https://api.example.com/api/v1");
  });
  it.each([
    undefined,
    "http://api.example.com/api/v1",
    "https://localhost/api/v1",
    "https://api.example.com",
    "https://secret@api.example.com/api/v1",
  ])("rejects unsafe production configuration: %s", (value) => {
    expect(() => resolvePublicApiUrl(value, "production")).toThrow();
  });
});
