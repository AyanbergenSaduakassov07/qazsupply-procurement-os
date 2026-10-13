export type ProcRole = "buyer" | "approver" | "supplier" | "viewer";

/** The caller's part in procurement for the active org (the database re-checks every action). */
export function procRole(role: string | undefined): ProcRole {
  if (role === "client_admin" || role === "qazsupply_admin") return "approver";
  if (role === "client_user") return "buyer";
  if (role === "supplier") return "supplier";
  return "viewer";
}
