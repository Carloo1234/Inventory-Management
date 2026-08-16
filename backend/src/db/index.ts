import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless"; // Use this instead
import { Pool } from "@neondatabase/serverless";
import * as schema from "./schema";

// const sql = neon(env.DATABASE_URL);
// export const db = drizzle(sql);

// Replace http connection with WebSocket Pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface QueryOptions {
    tx?: DatabaseTransaction;
    forUpdate?: boolean;
}
