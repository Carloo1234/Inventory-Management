import { db } from "../../db/index";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import redisClient from "../../config/redis";
import { env } from "../../config/env";
import { parseTime } from "../../utils/generalUtils";
import { SessionHandler, type SessionData } from "../../utils/redisHandler";
import { AppError } from "../../utils/AppError";

interface PgError extends Error {
    code: string; // PostgreSQL error code (e.g., '23505')
    detail?: string; // Extra details like the conflicting key
    table?: string; // Table name
    constraint?: string; // Specific constraint violated
}

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

    createSession = async (sessionId: string, sessionData: SessionData) => {
        console.log("Create session ran");

        return await SessionHandler.createSession(sessionId, sessionData);
    };
}
