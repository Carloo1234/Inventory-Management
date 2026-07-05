import { sql } from "drizzle-orm";
import { pgTable, uuid, timestamp, varchar, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
    id: uuid("id")
        .primaryKey()
        .default(sql`uuidv7()`),
    name: varchar("name", { length: 255 }),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
        .defaultNow()
        .notNull()
        .$onUpdate(() => new Date()),
});
