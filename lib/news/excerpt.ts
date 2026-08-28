export function newsExcerpt(body: string, max = 180): string {
  const collapsed = body.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  return `${collapsed.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}
