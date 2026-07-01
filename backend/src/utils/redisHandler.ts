import { createClientPool } from "redis";
import { env } from "../config/env";
import redisClient from "../config/redis";
import { parseTime } from "./generalUtils";

export type SessionData = {
    userId: string;
    familyId: string;
    ipAddress: string;
    revoked: "true" | "false";
    cat: string;
};
function escapeTag(value: string): string {
    return value.replace(/[-,.<>{}[\]"':;!@#$%^&*()+=~ ]/g, "\\$&");
}

const redisPool = await createClientPool()
    .on("error", (err) => console.error("Redis Client Pool Error", err))
    .connect();

export class SessionHandler {
    static createSession = async (sessionId: string, sessionData: SessionData) => {
        try {
            const key = `auth:sessions:${sessionId}`;
            await redisClient.multi().hSet(key, sessionData).expire(key, parseTime(env.SESSION_EXPIRY, "s")!).exec();
            return 1;
        } catch (error) {
            return 0;
        }
    };

    static getSessionData = async (sessionId: string) => {
        const data = await redisClient.hGetAll(`auth:sessions:${sessionId}`);
        if (Object.keys(data).length === 0) {
            return null;
        }
        return data as SessionData;
    };

    static deleteAllDeviceSessionKeys = async (sessionData: SessionData) => {
        const result = await redisClient.ft.search(
            "idx:auth:sessions",
            `@userId:{${escapeTag(sessionData.userId)}} @familyId:{${escapeTag(sessionData.familyId)}}`,
            {
                LIMIT: {
                    from: 0,
                    size: 1000, // Set this to the maximum expected size
                },
            },
        );
        if (result.total > 0) {
            await redisClient.del(result.documents.map((doc) => doc.id));
        }
    };
    static isInRecentlyRevoked = async (sessionId: string) => {
        return (await redisClient.exists(`auth:recently_revoked_sessions:${sessionId}`)) === 1;
    };

    static getDeviceCount = async (userId: string) => {
        const result = await redisClient.ft.search("idx:auth:sessions", `@userId:{${escapeTag(userId)}}`, {
            LIMIT: {
                from: 0,
                size: 1000, // Set this to the maximum expected size
            },
        });
        // Count how many unique family_id there is
        const familyIds: string[] = [];
        result.documents.forEach((doc) => {
            const familyId = doc.value.familyId;
            if (familyId && typeof familyId === "string") {
                if (!familyIds.includes(familyId)) {
                    familyIds.push(familyId);
                }
            }
        });
        return familyIds.length;
    };

    static rotateSessionToken = async (
        sessionId: string,
        sessionData: SessionData,
        newSessionId: string,
        newSessionData: SessionData,
    ) => {
        const key = `auth:sessions:${sessionId}`;
        const newKey = `auth:sessions:${newSessionId}`;
        const recentlyRevokedKey = `auth:recently_revoked_sessions:${sessionId}`;

        return redisPool?.execute(async (client) => {
            await client.watch(key);

            const result = await client
                .multi()
                .hSet(key, { revoked: "true" })
                .hSet(newKey, newSessionData)
                .hSet(recentlyRevokedKey, sessionData)
                .expire(recentlyRevokedKey, 10)
                .expire(key, parseTime(env.SESSION_EXPIRY, "s")!) // Sync expiry of old so that if hacker gets it later it still exists and is revoked
                .expire(newKey, parseTime(env.SESSION_EXPIRY, "s")!)
                .exec();
            // Key changed midway (Another request beat us to it and changed token
            // so this request should be marked in the grace zone)
            if (!result) {
                return null;
            }
            // Success
            return "success";
        });

        /*
        Could later add to delete revoked tokens that have lasted over 60 days to clear memory as it's 
        unlikely that hacker attempts to use token he got 60 days later
        Which if hacker did do that, it would just ask him to log in and it wont detect suspisious activity.
        The worry would be that the hacker somehow has access to the cookies
        (lives with user, but he has access to the account too which is user's fault not ours and we minimized risk as best we can)
        */
    };
}
