/** Only same-site relative paths, to prevent open redirects. */
export function safeNext(value: unknown, fallback = "/workspaces"): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : fallback;
}
