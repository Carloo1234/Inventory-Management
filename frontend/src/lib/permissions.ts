import type { Shop } from "./queries";

/**
 * Single permission gate for the whole frontend: owners can do everything,
 * managers only what their permission list explicitly contains.
 * Backend enforces for real; this only decides show vs hide vs disable.
 */
export function hasPerm(shop: Shop | undefined, ...perms: string[]): boolean {
    if (!shop) return false;
    if (shop.isOwner) return true;
    return perms.every((p) => shop.managerPermissions?.includes(p) ?? false);
}

/** True if the viewer holds at least one of the given permissions. */
export function hasAnyPerm(shop: Shop | undefined, ...perms: string[]): boolean {
    if (!shop) return false;
    if (shop.isOwner) return true;
    return perms.some((p) => shop.managerPermissions?.includes(p) ?? false);
}
