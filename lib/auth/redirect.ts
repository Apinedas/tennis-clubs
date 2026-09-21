// Solo se aceptan rutas internas en el parámetro `next`, para evitar
// redirecciones abiertas hacia otros dominios.
export function safeNext(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }
  return value.length <= 300 ? value : null;
}
