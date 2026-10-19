export function parseAllowedOrigins(value: string): string[] {
  const origins = value.split(",").map((entry) => {
    const url = new URL(entry.trim());
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      throw new Error("ALLOWED_ORIGINS must contain HTTP(S) origins.");
    }
    return url.origin;
  });
  return [...new Set(origins)];
}

export function corsHeaders(
  origin: string,
  allowed: readonly string[],
): Record<string, string> {
  return {
    ...(allowed.includes(origin)
      ? { "Access-Control-Allow-Origin": origin }
      : {}),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}
