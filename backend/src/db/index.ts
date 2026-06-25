import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
if (!process.env.DATABASE_URL) {
    throw new Error("Couldn't find the database url in .env");
}
const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql);
