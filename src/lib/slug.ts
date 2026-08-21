export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
}

export function randomSlug(prefix = ""): string {
  const r = Math.random().toString(36).slice(2, 8);
  return prefix ? `${prefix}-${r}` : r;
}
