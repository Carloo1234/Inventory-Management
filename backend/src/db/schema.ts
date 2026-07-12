import { sql, relations } from "drizzle-orm";

import {
    pgTable,
    uuid,
    timestamp,
    varchar,
    boolean,
    text,
    numeric,
    integer,
    unique,
    foreignKey,
    primaryKey,
} from "drizzle-orm/pg-core";

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

export const shops = pgTable("shops", {
    id: uuid("id")
        .primaryKey()
        .default(sql`uuidv7()`),
    name: varchar("name", { length: 255 }).notNull(),
    ownerId: uuid("owner_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
});

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

// Thorugh table
export const productVariantsAttributeValues = pgTable(
    "product_variants_attribute_values",
    {
        productVariantId: uuid("product_variant_id")
            .references(() => productVariants.id, { onDelete: "cascade" })
            .notNull(),
        attributeValueId: uuid("attribute_value_id")
            .references(() => attributeValues.id, { onDelete: "cascade" })
            .notNull(),
    },
    (table) => [primaryKey({ columns: [table.productVariantId, table.attributeValueId] })],
);

// Relations

export const userRelations = relations(users, ({ many }) => ({ shops: many(shops) }));

export const shopRelations = relations(shops, ({ many }) => ({ products: many(products) }));

export const productsRelations = relations(products, ({ many }) => ({ productVariants: many(productVariants) }));

export const productVariantsRelations = relations(productVariants, ({ many }) => ({
    variantAttributeValues: many(productVariantsAttributeValues),
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
