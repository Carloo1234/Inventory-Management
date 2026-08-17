export const PERMISSIONS = {
    SHOP_READ: { value: "shop:read", friendlyName: "View Shop(s)" },
    SHOP_UPDATE: { value: "shop:update", friendlyName: "Update Shop(s)" },
    SHOP_DELETE: { value: "shop:delete", friendlyName: "Delete Shop" },
    PRODUCT_CREATE: { value: "product:create", friendlyName: "Create Product(s)" },
    PRODUCT_UPDATE: { value: "product:update", friendlyName: "Update Product(s)" },
    PRODUCT_READ: { value: "product:read", friendlyName: "View Product(s)" },
    PRODUCT_DELETE: { value: "product:delete", friendlyName: "Delete Product(s)" },
} as const;

export type PermissionValue = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]["value"];

// O(1) Map lookup for friendly names
const FRIENDLY_NAME_MAP = new Map<string, string>(Object.values(PERMISSIONS).map((p) => [p.value, p.friendlyName]));

// O(1) Set lookup for quick validation
export const VALID_PERMISSIONS_SET = new Set<string>(FRIENDLY_NAME_MAP.keys());

export const getFriendlyNameFromValue = (value: PermissionValue): string => {
    return FRIENDLY_NAME_MAP.get(value) ?? value;
};
