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

export const PRIMARY_NAV: NavItem[] = [
  { key: "dashboard", path: "", labelKey: "nav.dashboard" },
  { key: "suppliers", path: "/suppliers", labelKey: "nav.suppliers", disabled: true },
  { key: "rfq", path: "/rfq", labelKey: "nav.rfq", disabled: true },
  { key: "shipments", path: "/shipments", labelKey: "nav.shipments", disabled: true },
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
