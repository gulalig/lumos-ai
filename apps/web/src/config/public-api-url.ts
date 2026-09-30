export function resolvePublicApiUrl(
  value: string | undefined,
  environment: string | undefined,
): string {
  if (!value && environment === "production") {
    throw new Error("NEXT_PUBLIC_API_URL is required for production builds");
  }
  const configured = value || "http://localhost:3001/api/v1";
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("NEXT_PUBLIC_API_URL must be an absolute HTTP(S) URL");
  }
  const local = /^(localhost|.*\.localhost|127(?:\.\d+){3}|\[::1\])$/.test(
    url.hostname,
  );
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname.replace(/\/$/, "") !== "/api/v1" ||
    (environment === "production" && (url.protocol !== "https:" || local))
  ) {
    throw new Error(
      "NEXT_PUBLIC_API_URL must point to /api/v1; production requires public HTTPS",
    );
  }
  return url.toString().replace(/\/$/, "");
}
