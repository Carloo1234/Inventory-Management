import { PERMISSIONS, type PermissionValue } from "./permissions";

export interface RolePreset {
    id: string;
    name: string;
    description: string;
    permissions: PermissionValue[];
}

// Preset bundles served alongside the permission catalog so the frontend
// never hardcodes permission sets. Values reference PERMISSIONS constants
// (not raw strings) so renames propagate and typos fail at compile time.
const ALL: PermissionValue[] = Object.values(PERMISSIONS).map((p) => p.value);

export const ROLE_PRESETS: RolePreset[] = [
    {
        id: "co-owner",
        name: "Co-Owner",
        description: "Full access to everything in this shop.",
        permissions: ALL,
    },
    {
        id: "manager",
        name: "Manager",
        description: "Runs day-to-day operations. Cannot delete the shop, roles, or managers.",
        permissions: ALL.filter(
            (p) =>
                p !== PERMISSIONS.SHOP_DELETE.value &&
                p !== PERMISSIONS.ROLES_DELETE.value &&
                p !== PERMISSIONS.MANAGER_DELETE.value,
        ),
    },
    {
        id: "cashier",
        name: "Cashier",
        description: "Sells and views products. Changes nothing structural.",
        permissions: [
            PERMISSIONS.SHOP_READ.value,
            PERMISSIONS.PRODUCT_CREATE.value,
            PERMISSIONS.PRODUCT_READ.value,
            PERMISSIONS.PRODUCT_UPDATE.value,
            PERMISSIONS.INVITE_READ.value,
        ],
    },
];
