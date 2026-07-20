import { db, type QueryOptions } from "../../db/index";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import { SessionHandler, type SessionData } from "../../utils/redisHandler";
import { AppError } from "../../utils/AppError";
import type { PgSelectBuilder } from "drizzle-orm/pg-core";

interface PgError extends Error {
    code: string; // PostgreSQL error code (e.g., '23505')
    detail?: string; // Extra details like the conflicting key
    table?: string; // Table name
    constraint?: string; // Specific constraint violated
}

type UserField = keyof typeof users.$inferSelect;

export class AuthRepository {
    async doesUserExist(email: string): Promise<boolean> {
        console.log("Does user exist ran");

        const [user] = await db.select().from(users).where(eq(users.email, email));
        if (user) {
            return true;
        }
        return false;
    }

    createUser = async (userId: string, name: string, email: string, hashedPassword: string) => {
        console.log("Create user ran");

        try {
            const userdb = await db
                .insert(users)
                .values({
                    id: userId,
                    name: name,
                    email: email,
                    passwordHash: hashedPassword,
                })
                .returning();
            const user = userdb[0]!;
            return user;
        } catch (e) {
            const error = e as PgError;
            if (error.code === "23505") {
                throw new AppError("User has been created. You issued concurrent requests.", 409);
            }
            throw new AppError("Database error has occured. Please try again later.", 500);
        }
    };

    getUserWithEmail = async (email: string) => {
        try {
            const user = (await db.select().from(users).where(eq(users.email, email)))[0];
            if (!user) return null;
            return user;
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError("Error fetching user from database", 501);
        }
    };

    getUserWithUserId = async <T = Partial<typeof users.$inferSelect>>(
        userId: string,
        specificFields: UserField[] = [],
        options?: QueryOptions,
    ) => {
        const tx = options?.tx || db;
        try {
            let baseQuery: any;
            if (specificFields.length === 0) {
                baseQuery = tx.select();
            } else {
                const selectObject: Record<string, any> = {};
                for (let field of specificFields) {
                    selectObject[field] = users[field];
                }
                baseQuery = tx.select(selectObject);
            }
            let query = baseQuery.from(users).where(eq(users.id, userId));
            if (options?.forUpdate) {
                query = query.for("update");
            }

            const result = (await query)[0];
            if (specificFields.length === 0) return (result as typeof users.$inferSelect) || null;
            return (result as T) || null;
        } catch (error) {
            console.log(error);
            throw new AppError("Error fetching user from database", 500);
        }
    };

    createSession = async (sessionId: string, sessionData: SessionData) => {
        return await SessionHandler.createSession(sessionId, sessionData);
    };

    getDeviceCount = async (userId: string) => {
        return await SessionHandler.getDeviceCount(userId);
    };

    deleteDeviceSessions = async (sessionId: string) => {
        const sessionData = await SessionHandler.getSessionData(sessionId);
        if (!sessionData) {
            return 1; // Success
        }
        await SessionHandler.deleteAllDeviceSessionKeys(sessionData);
        return 1;
    };
}
