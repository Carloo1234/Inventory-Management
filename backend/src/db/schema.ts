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

export const tokens = pgTable("tokens", {
    id: uuid("id")
        .primaryKey()
        .default(sql`uuidv7()`),
    hashedToken: varchar("token", { length: 64 }).notNull().unique(),
    authId: uuid("auth_id").notNull(),
    userId: uuid("user_id")
        .references(() => users.id, { onDelete: "cascade" })
        .notNull(),
    ip: varchar("ip", { length: 45 }),
    isRevoked: boolean("is_revoked").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});
