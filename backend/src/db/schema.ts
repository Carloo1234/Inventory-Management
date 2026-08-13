import { sql, relations } from "drizzle-orm";

import {
    pgTable,
    uuid,
    timestamp,
    varchar,
    text,
    numeric,
    integer,
    unique,
    foreignKey,
    primaryKey,
    boolean,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
    id: uuid("id")
        .primaryKey()
        .default(sql`uuidv7()`),
    name: varchar("name", { length: 255 }),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),

    shopLimit: integer().notNull().default(5), // Max shop count
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
        .defaultNow()
        .notNull()
        .$onUpdate(() => new Date()),
});

export const shops = pgTable("shops", {
    id: uuid("id")
        .primaryKey()
        .default(sql`uuidv7()`),
    name: varchar("name", { length: 255 }).notNull(),
    ownerId: uuid("owner_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
        .defaultNow()
        .notNull()
        .$onUpdate(() => new Date()),
    softDelete: boolean("soft_delete").default(false),
});
export const roles = pgTable("roles", {
    id: uuid("id")
        .primaryKey()
        .default(sql`uuidv7()`),
    // null shopId means it's a global/system default role (Owner, Manager, Viewer)
    // populated shopId means it's a custom role created by a specific shop
    shopId: uuid("shop_id").references(() => shops.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),

    // Store permission keys directly as a text array!
    // Example: ["products:create", "products:read", "shop:settings"]
    permissions: text("permissions")
        .array()
        .notNull()
        .default(sql`'{}'::text[]`),

    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const shopManagers = pgTable(
    "shop_managers",
    {
        shopId: uuid("shop_id")
            .references(() => shops.id, { onDelete: "cascade" })
            .notNull(),
        managerId: uuid("manager_id")
            .references(() => users.id, { onDelete: "cascade" })
            .notNull(),
        roleId: uuid("role_id")
            .references(() => roles.id)
            .notNull(),
        invitedByUserId: uuid("invited_by_user_id").references(() => users.id, { onDelete: "set null" }),
        createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [primaryKey({ columns: [table.shopId, table.managerId] })],
);

export const shopInvitations = pgTable(
    "shop_invitations",
    {
        id: uuid("id")
            .primaryKey()
            .default(sql`uuidv7()`),
        invitedUserId: uuid("invited_user_id")
            .references(() => users.id, { onDelete: "cascade" })
            .notNull(),
        invitedByUserId: uuid("invited_by_user_id")
            .references(() => users.id, { onDelete: "cascade" })
            .notNull(),
        shopId: uuid("shop_id")
            .references(() => shops.id, { onDelete: "cascade" })
            .notNull(),
        roleId: uuid("role_id")
            .references(() => roles.id)
            .notNull(),
        expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true })
            .default(sql`now() + interval '30 days'`)
            .notNull(),
        createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [unique("unique_shop_invited_user").on(table.shopId, table.invitedUserId)],
);

export const products = pgTable(
    "products",
    {
        id: uuid("id")
            .primaryKey()
            .default(sql`uuidv7()`),
        shopId: uuid("shop_id")
            .references(() => shops.id, { onDelete: "cascade" })
            .notNull(),
        name: varchar("name", { length: 255 }).notNull(),
        description: text("description"),

        createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        // Required for postgres composite forign key even tho redundant logically
        unique("unique_product_id_shop_id").on(table.id, table.shopId),
    ],
);

export const attributeNames = pgTable(
    "attribute_names",
    {
        id: uuid("id")
            .primaryKey()
            .default(sql`uuidv7()`),
        shopId: uuid("shop_id")
            .references(() => shops.id, { onDelete: "cascade" })
            .notNull(),
        name: varchar("name", { length: 100 }).notNull(),
        createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [unique("unique_name_shop_id").on(table.shopId, table.name)],
);

export const attributeValues = pgTable(
    "attribute_values",
    {
        id: uuid("id")
            .primaryKey()
            .default(sql`uuidv7()`),
        attributeNameId: uuid("attribute_name_id")
            .references(() => attributeNames.id, { onDelete: "cascade" })
            .notNull(),
        value: varchar("value", { length: 100 }).notNull(),
        createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [unique("unique_attribute_name_value").on(table.attributeNameId, table.value)],
);

export const productVariants = pgTable(
    "product_variants",
    {
        id: uuid("id")
            .primaryKey()
            .default(sql`uuidv7()`),
        productId: uuid("product_id")
            .references(() => products.id, { onDelete: "cascade" })
            .notNull(),
        shopId: uuid("shop_id").notNull(),
        sku: varchar("sku", { length: 16 }).notNull(),
        barcode: varchar("barcode", { length: 14 }),
        price: numeric("price", { precision: 12, scale: 2 }).notNull(),
        quantity: integer("quantity").notNull().default(0),
        createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        foreignKey({
            name: "fk_variant_to_product_and_shop",
            columns: [table.productId, table.shopId],
            foreignColumns: [products.id, products.shopId],
        }).onDelete("cascade"),
        unique("unique_shop_variant_sku").on(table.shopId, table.sku),
        unique("unique_shop_variant_barcode").on(table.shopId, table.barcode),
    ],
);

// Through table
export const productVariantsAttributeValues = pgTable(
    "product_variants_attribute_values",
    {
        productVariantId: uuid("product_variant_id")
            .references(() => productVariants.id, { onDelete: "cascade" })
            .notNull(),
        attributeValueId: uuid("attribute_value_id")
            .references(() => attributeValues.id, { onDelete: "cascade" })
            .notNull(),
        createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [primaryKey({ columns: [table.productVariantId, table.attributeValueId] })],
);

// Relations

export const userRelations = relations(users, ({ many }) => ({
    shopsOwned: many(shops),
    managedShops: many(shopManagers, { relationName: "managerToUser" }),
    sentManagerInvitations: many(shopManagers, { relationName: "invitedByToUser" }),
    receivedInvitations: many(shopInvitations, { relationName: "invitedUserToUser" }),
    sentInvitations: many(shopInvitations, { relationName: "invitedByUserToUser" }),
}));

export const shopRelations = relations(shops, ({ many, one }) => ({
    owner: one(users, {
        fields: [shops.ownerId],
        references: [users.id],
    }),
    products: many(products),
    attributeNames: many(attributeNames),
    managers: many(shopManagers),
    invitations: many(shopInvitations),
}));

export const shopManagersRelations = relations(shopManagers, ({ one }) => ({
    shop: one(shops, {
        fields: [shopManagers.shopId],
        references: [shops.id],
    }),
    manager: one(users, {
        fields: [shopManagers.managerId],
        references: [users.id],
        relationName: "managerToUser",
    }),
    invitedBy: one(users, {
        fields: [shopManagers.invitedByUserId],
        references: [users.id],
        relationName: "invitedByToUser",
    }),
    role: one(roles, { fields: [shopManagers.roleId], references: [roles.id] }),
}));

export const shopInvitationsRelations = relations(shopInvitations, ({ one }) => ({
    shop: one(shops, {
        fields: [shopInvitations.shopId],
        references: [shops.id],
    }),
    invitedUser: one(users, {
        fields: [shopInvitations.invitedUserId],
        references: [users.id],
        relationName: "invitedUserToUser",
    }),
    invitedBy: one(users, {
        fields: [shopInvitations.invitedByUserId],
        references: [users.id],
        relationName: "invitedByUserToUser",
    }),
}));

export const productsRelations = relations(products, ({ many, one }) => ({
    productVariants: many(productVariants),
    shop: one(shops, {
        fields: [products.shopId],
        references: [shops.id],
    }),
}));

export const productVariantsRelations = relations(productVariants, ({ many, one }) => ({
    variantAttributeValues: many(productVariantsAttributeValues),
    product: one(products, {
        fields: [productVariants.productId, productVariants.shopId],
        references: [products.id, products.shopId],
    }),
}));

export const productVariantsAttributeValuesRelations = relations(productVariantsAttributeValues, ({ one }) => ({
    productVariant: one(productVariants, {
        fields: [productVariantsAttributeValues.productVariantId],
        references: [productVariants.id],
    }),
    attributeValue: one(attributeValues, {
        fields: [productVariantsAttributeValues.attributeValueId],
        references: [attributeValues.id],
    }),
}));

export const attributeValuesRelations = relations(attributeValues, ({ one }) => ({
    attributeName: one(attributeNames, {
        fields: [attributeValues.attributeNameId],
        references: [attributeNames.id],
    }),
}));

export const attributeNamesRelations = relations(attributeNames, ({ many, one }) => ({
    values: many(attributeValues),
    shop: one(shops, { fields: [attributeNames.shopId], references: [shops.id] }),
}));
export const rolesRelations = relations(roles, ({ many, one }) => ({
    shop: one(shops, { fields: [roles.shopId], references: [shops.id] }),
    managers: many(shopManagers),
}));

// TODO: Add indexes later to speed up database
