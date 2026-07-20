import { eq } from "drizzle-orm";
import { db, type QueryOptions } from "../../db";
import { shops } from "../../db/schema";
import { AppError } from "../../utils/AppError";

export class ShopsRepository {
    getUserShopsCount = async (userId: string, options?: QueryOptions) => {
        const tx = options?.tx || db;
        const count = await tx.$count(shops, eq(shops.ownerId, userId));
        return count;
    };
    createShop = async (name: string, ownerId: string, options?: QueryOptions) => {
        const tx = options?.tx || db;
        try {
            const shop = await tx.insert(shops).values({ name, ownerId }).returning();
            return shop[0];
        } catch (error) {
            console.log(error);
            throw new AppError("Database error occured creating shop.", 500);
        }
    };
}
