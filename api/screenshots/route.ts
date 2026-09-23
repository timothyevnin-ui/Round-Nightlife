/**
 * Retired in V5 ("Add from screenshots"). Kept so an upload replaces the old
 * route; it answers 410 Gone. Safe to delete.
 */
export function POST() {
  return Response.json({ error: "This feature was retired." }, { status: 410 });
}
