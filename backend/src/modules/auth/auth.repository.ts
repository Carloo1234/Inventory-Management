import { db } from "../../db/index";
import { users } from "../../db/schema";
import { AppError } from "../../utils/AppError";
import { eq } from "drizzle-orm";

export class AuthRepository {
    async doesUserExist(email: string): Promise<boolean> {
        const [user] = await db.select().from(users).where(eq(users.email, email));
        if (user) {
            return true;
        }
        return false;
    }
    async createUser(name: string, email: string, hashPassword: string) {
        try {
            const [user] = await db
                .insert(users)
                .values({
                    name: name,
                    email: email,
                    passwordHash: hashPassword,
                })
                .returning();
            return user;
        } catch (error) {
            if (error instanceof Error) {
                throw new AppError(`Database Insert Error | ${error.message}`, 500);
            }
            throw new AppError(`Database Insert Error`, 500);
        }
    }
}
