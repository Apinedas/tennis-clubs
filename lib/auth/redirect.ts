// Only internal paths are accepted in the `next` parameter, to avoid open
// redirects to other domains.
export function safeNext(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }
  return value.length <= 300 ? value : null;
}
