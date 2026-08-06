import { db } from "../../db";
import { AppError } from "../../utils/AppError";
import type { AuthRepository } from "../auth/auth.repository";
import type { ShopsRepository } from "./shops.repository";
import type { PatchShopBody } from "./shops.schemas";

export class ShopsServices {
    private shopRepository: ShopsRepository;
    private userRepository: AuthRepository;
    constructor(shopRepository: ShopsRepository, userRepository: AuthRepository) {
        this.shopRepository = shopRepository;
        this.userRepository = userRepository;
    }
    createShop = async (name: string, ownerId: string) => {
        // Check if user's shop limit is surpassed or not
        const shop = await db.transaction(async (tx) => {
            // for update to lock
            const userData = await this.userRepository.getUserWithUserId<{ shopLimit: number }>(
                ownerId,
                ["shopLimit"],
                { tx, forUpdate: true },
            );
            const shopCount = await this.shopRepository.getUserShopsCount(ownerId, { tx });

            if (!userData) throw new AppError("Couldn't find your user data", 404);

            if (shopCount >= userData.shopLimit) {
                throw new AppError(
                    "Sorry, you can't create more shops, you have exceeded your shop limit. Please contact us if you wish to increase it.",
                    403,
                );
            }
            // Can still create shops
            const shop = await this.shopRepository.createShop(name, ownerId, { tx });
            if (!shop) throw new AppError("Error occured creating shop", 500); // I think tis is an impossible case
            return shop;
        });
        return shop;
    };

    getUserShops = async (userId: string) => {
        const shops = await this.shopRepository.getUserShops(userId);
        return shops;
    };

    getShop = async (shopId: string, userId: string) => {
        const shop = await this.shopRepository.getShop(shopId);
        if (!shop) throw new AppError("Shop not found.", 404);
        if (shop.ownerId !== userId) {
            throw new AppError("You do not have permission to access this shop.", 403);
        }
        return shop;
    };

    deleteShop = async (shopId: string, userId: string) => {
        const updatedShop = await this.shopRepository.softDeleteShop(shopId, userId);
        if (!updatedShop) {
            throw new AppError("Shop was not found to delete.", 404); // Or its possible shop belongs to another user but we send this unified response.
        }
        return updatedShop;
    };

    updateShop = async (shopId: string, userId: string, data: PatchShopBody) => {
        const updatedShop = await this.shopRepository.updateShop(shopId, userId, data);
        if (!updatedShop) {
            throw new AppError("Shop was not found", 404); // Even if exists but not owned by user. unified message to prevent hacker from knowing shopId's potentailly
        }
        return updatedShop;
    };
}
