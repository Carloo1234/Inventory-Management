import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
    NODE_ENV: z.string(),
    PORT: z.coerce.number().default(3000),
    TRUST_PROXY: z.enum(["true", "false"]).transform((v) => v === "true"),
    COOKIE_SAMESITE: z.enum(["lax", "none", "strict"]),
    DATABASE_URL: z.string(),
    SESSION_EXPIRY: z.string().regex(/^\d+(ms|s|m|h|d|w)$/i),
    SESSION_ROTATION: z.string().regex(/^\d+(ms|s|m|h|d|w)$/i),
    REDIS_URL: z.string(),
});

const envResult = envSchema.safeParse(process.env);

if (!envResult.success) {
    console.log("ENV ERRORS OCCURED:-");
    console.log(z.prettifyError(envResult.error));
    process.exit(1);
}

export const env = envResult.data;
