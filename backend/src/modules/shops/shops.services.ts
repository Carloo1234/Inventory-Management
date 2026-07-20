import { db } from "../../db";
import { AppError } from "../../utils/AppError";
import type { AuthRepository } from "../auth/auth.repository";
import type { ShopsRepository } from "./shops.repository";

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
}
