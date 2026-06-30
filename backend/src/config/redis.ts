import { createClient, SCHEMA_FIELD_TYPE } from "redis";
import { env } from "./env";

const redisClient = createClient({ url: env.NODE_ENV === "production" ? env.REDIS_URL : "redis://localhost:6379" });

redisClient.on("error", (error) => {
    console.log("Redis Client Error ", error);
});

redisClient.on("connect", () => console.log("Redis Client Connected"));

export const connectRedis = async () => {
    if (!redisClient.isOpen) {
        await redisClient.connect();
    }
};

export const initSearchIndexes = async () => {
    await redisClient.ft.create(
        "idx:auth:sessions",
        {
            userId: { type: SCHEMA_FIELD_TYPE.TAG },
            familyId: { type: SCHEMA_FIELD_TYPE.TAG },
        },
        {
            ON: "HASH",
            PREFIX: "auth:sessions:",
        },
    );
};

export default redisClient;
