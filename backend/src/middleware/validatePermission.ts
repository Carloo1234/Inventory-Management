import type { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../utils/apiResponse";
import { ShopsRepository } from "../modules/shops/shops.repository";
import type { Shop } from "../modules/shops/shops.schemas";
import { AppError } from "../utils/AppError";
import { getFriendlyNameFromValue, VALID_PERMISSIONS_SET, type PermissionValue } from "../utils/permissions";

const shopRepository = new ShopsRepository();

// Removed outer 'async' wrapper so Express receives the middleware function directly
export const validatePermission = (requiredPermissions: PermissionValue[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const { sessionData } = req;
        const shopId = req.params.shopId;

        if (!shopId || Array.isArray(shopId)) {
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });
        }

        const shop: Shop | null = await shopRepository.getUserShop(shopId, sessionData!.userId);
        if (!shop) throw new AppError("Shop not found", 404);

        // 1. Owner bypasses all checks
        if (shop.isOwner) {
            return next();
        }

        // 2. Reject non-owners without manager permissions
        const managerPermissions = shop.managerPermissions;
        if (!managerPermissions || !Array.isArray(managerPermissions)) {
            throw new AppError("You do not have manager permissions for this shop", 403);
        }

        // 3. Enforce required permissions strictly
        for (const permission of requiredPermissions) {
            // Guard against developer typos in routes
            if (!VALID_PERMISSIONS_SET.has(permission)) {
                throw new AppError(`Invalid permission configuration: ${permission}`, 500);
            }

            if (!managerPermissions.includes(permission)) {
                const friendlyName = getFriendlyNameFromValue(permission);
                throw new AppError(`You do not have permission to ${friendlyName}`, 403);
            }
        }

        next();
    };
};
