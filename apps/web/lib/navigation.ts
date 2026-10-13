import type { MessageKey } from "@qazsupply/i18n";

export type Role = "client_admin" | "client_user" | "reviewer" | "qazsupply_admin" | "supplier";

export interface NavItem {
  key: string;
  /** Path after the locale segment. */
  path: string;
  labelKey: MessageKey;
  /** Roles allowed to see the item; undefined means every signed-in role. */
  roles?: Role[];
  /** Visible but disabled (feature not built yet). */
  disabled?: boolean;
}

const READERS: Role[] = ["client_admin", "client_user", "reviewer", "qazsupply_admin"];

export const PRIMARY_NAV: NavItem[] = [
  { key: "dashboard", path: "", labelKey: "nav.dashboard" },
  { key: "uploads", path: "/spend", labelKey: "nav.uploads", roles: READERS },
  { key: "review", path: "/spend/review", labelKey: "nav.review", roles: READERS },
  { key: "findings", path: "/spend/reports", labelKey: "nav.findings", roles: READERS },
  { key: "suppliers", path: "/suppliers", labelKey: "nav.suppliers", roles: READERS },
  { key: "rfq", path: "/rfqs", labelKey: "nav.rfq", roles: [...READERS, "supplier"] },
  { key: "catalogue", path: "/catalogue", labelKey: "nav.catalogue", roles: READERS },
  { key: "shipments", path: "/shipments", labelKey: "nav.shipments", disabled: true },
  { key: "onboarding", path: "/onboarding", labelKey: "nav.onboarding", roles: ["supplier"] },
];

export const ADMIN_NAV: NavItem[] = [
  {
    key: "audit",
    path: "/audit",
    labelKey: "nav.audit",
    roles: ["client_admin", "qazsupply_admin"],
  },
];

export function visibleNav(
  roles: Role[],
  items: NavItem[] = [...PRIMARY_NAV, ...ADMIN_NAV],
): NavItem[] {
  return items.filter((item) => (item.roles ? item.roles.some((r) => roles.includes(r)) : true));
}
