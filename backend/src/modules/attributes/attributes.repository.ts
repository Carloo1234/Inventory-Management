import { and, eq } from "drizzle-orm";
import { db, type QueryOptions } from "../../db";
import { attributeNames, attributeValues, productVariantsAttributeValues } from "../../db/schema";
import { AppError } from "../../utils/AppError";
import { getPgErrorCode } from "../../utils/db-errors";
import type z from "zod";
import type { updateAttributeNameSchema, updateAttributeValueSchema } from "./attributes.schema";

export class AttributesRepository {
    createAttributeName = async ({
        name,
        shopId,
        queryOptions,
    }: {
        name: string;
        shopId: string;
        queryOptions?: QueryOptions;
    }) => {
        const tx = queryOptions?.tx || db;
        try {
            const attributeName = (await tx.insert(attributeNames).values({ name, shopId }).returning())[0];
            // Idk if its possible for no error to be thrown but attributeName is undefined but handle it here
            if (!attributeName) throw new AppError("Failed to create attribute name", 500);
            return attributeName;
        } catch (error) {
            if (error instanceof AppError) throw error;
            // unique_name_shop_id: same name twice in one shop.
            if (getPgErrorCode(error) === "23505") {
                throw new AppError("An attribute with this name already exists in this shop", 409);
            }
            console.log(error);
            throw new AppError("Failed to create attribute name", 500);
        }
    };

    getAttributeNames = async ({ shopId, queryOptions }: { shopId: string; queryOptions?: QueryOptions }) => {
        const tx = queryOptions?.tx || db;
        try {
            // Values embedded so the frontend builds pickers in one fetch.
            const names = await tx.query.attributeNames.findMany({
                where: eq(attributeNames.shopId, shopId),
                with: { values: true },
            });
            return names;
        } catch (error) {
            console.log(error);
            throw new AppError("Failed to fetch attribute names", 500);
        }
    };

    getAttributeNameById = async ({
        attributeNameId,
        shopId,
        queryOptions,
    }: {
        attributeNameId: string;
        shopId: string;
        queryOptions?: QueryOptions;
    }) => {
        const tx = queryOptions?.tx || db;
        try {
            // Composite key: a name is only addressable within its shop (IDOR guard).
            const name = await tx.query.attributeNames.findFirst({
                where: and(eq(attributeNames.id, attributeNameId), eq(attributeNames.shopId, shopId)),
                with: { values: true },
            });
            if (!name) throw new AppError("Attribute not found", 404);
            return name;
        } catch (error) {
            if (error instanceof AppError) throw error;
            console.log(error);
            throw new AppError("Failed to fetch attribute name", 500);
        }
    };

    updateAttributeNameById = async ({
        attributeNameId,
        shopId,
        data,
        queryOptions,
    }: {
        attributeNameId: string;
        shopId: string;
        data: z.infer<typeof updateAttributeNameSchema>;
        queryOptions?: QueryOptions;
    }) => {
        const tx = queryOptions?.tx || db;
        try {
            // Only set provided fields; empty body is rejected by the service.
            const updated = await tx
                .update(attributeNames)
                .set({ ...(data.name !== undefined ? { name: data.name } : {}) })
                .where(and(eq(attributeNames.id, attributeNameId), eq(attributeNames.shopId, shopId)))
                .returning();
            if (!updated[0]) throw new AppError("Attribute not found", 404);
            return updated[0];
        } catch (error) {
            if (error instanceof AppError) throw error;
            // Renaming onto an existing sibling name in the same shop.
            if (getPgErrorCode(error) === "23505") {
                throw new AppError("An attribute with this name already exists in this shop", 409);
            }
            console.log(error);
            throw new AppError("Failed to update attribute name", 500);
        }
    };

    deleteAttributeNameById = async ({
        attributeNameId,
        shopId,
        queryOptions,
    }: {
        attributeNameId: string;
        shopId: string;
        queryOptions?: QueryOptions;
    }) => {
        const tx = queryOptions?.tx || db;
        try {
            // Restrict: refuse deletion while any variant uses a value of this
            // name. Unused names (even with unused values) delete cleanly with
            // values cascading — no migration needed since the FKs stay cascade.
            const inUse = await tx
                .select({ variantId: productVariantsAttributeValues.productVariantId })
                .from(productVariantsAttributeValues)
                .innerJoin(
                    attributeValues,
                    eq(productVariantsAttributeValues.attributeValueId, attributeValues.id),
                )
                .where(eq(attributeValues.attributeNameId, attributeNameId))
                .limit(1);
            if (inUse.length > 0) {
                throw new AppError("Attribute is in use by products and cannot be deleted", 409);
            }
            const deleted = await tx
                .delete(attributeNames)
                .where(and(eq(attributeNames.id, attributeNameId), eq(attributeNames.shopId, shopId)))
                .returning();
            if (!deleted[0]) throw new AppError("Attribute not found", 404);
            return deleted[0];
        } catch (error) {
            if (error instanceof AppError) throw error;
            console.log(error);
            throw new AppError("Failed to delete attribute name", 500);
        }
    };

    createAttributeValue = async ({
        attributeNameId,
        shopId,
        value,
        queryOptions,
    }: {
        attributeNameId: string;
        shopId: string;
        value: string;
        queryOptions?: QueryOptions;
    }) => {
        const tx = queryOptions?.tx || db;
        try {
            // Parent name must belong to this shop, otherwise the value would
            // silently attach to another shop's attribute (404, thrown inside).
            await this.getAttributeNameById(
                queryOptions ? { attributeNameId, shopId, queryOptions } : { attributeNameId, shopId },
            );
            const created = (
                await tx.insert(attributeValues).values({ attributeNameId, value }).returning()
            )[0];
            if (!created) throw new AppError("Failed to create attribute value", 500);
            return created;
        } catch (error) {
            if (error instanceof AppError) throw error;
            // unique_attribute_name_value: same value twice under one name.
            if (getPgErrorCode(error) === "23505") {
                throw new AppError("This value already exists for this attribute", 409);
            }
            console.log(error);
            throw new AppError("Failed to create attribute value", 500);
        }
    };

    getAttributeValues = async ({
        attributeNameId,
        shopId,
        queryOptions,
    }: {
        attributeNameId: string;
        shopId: string;
        queryOptions?: QueryOptions;
    }) => {
        // Scoping check first: wrong-shop nameId 404s instead of leaking emptiness.
        const name = await this.getAttributeNameById(
            queryOptions ? { attributeNameId, shopId, queryOptions } : { attributeNameId, shopId },
        );
        return name.values;
    };

    getAttributeValueById = async ({
        attributeValueId,
        shopId,
        queryOptions,
    }: {
        attributeValueId: string;
        shopId: string;
        queryOptions?: QueryOptions;
    }) => {
        const tx = queryOptions?.tx || db;
        try {
            // Values carry no shopId, so scope through the parent name (IDOR guard).
            const value = await tx.query.attributeValues.findFirst({
                where: eq(attributeValues.id, attributeValueId),
                with: { attributeName: true },
            });
            if (!value || value.attributeName.shopId !== shopId) {
                throw new AppError("Attribute value not found", 404);
            }
            return value;
        } catch (error) {
            if (error instanceof AppError) throw error;
            console.log(error);
            throw new AppError("Failed to fetch attribute value", 500);
        }
    };

    updateAttributeValueById = async ({
        attributeValueId,
        shopId,
        data,
        queryOptions,
    }: {
        attributeValueId: string;
        shopId: string;
        data: z.infer<typeof updateAttributeValueSchema>;
        queryOptions?: QueryOptions;
    }) => {
        const tx = queryOptions?.tx || db;
        try {
            // Scoped existence check first (404 for foreign or missing ids).
            await this.getAttributeValueById(
                queryOptions ? { attributeValueId, shopId, queryOptions } : { attributeValueId, shopId },
            );
            const updated = await tx
                .update(attributeValues)
                .set({ ...(data.value !== undefined ? { value: data.value } : {}) })
                .where(eq(attributeValues.id, attributeValueId))
                .returning();
            if (!updated[0]) throw new AppError("Attribute value not found", 404);
            return updated[0];
        } catch (error) {
            if (error instanceof AppError) throw error;
            // Renaming onto a sibling value under the same name.
            if (getPgErrorCode(error) === "23505") {
                throw new AppError("This value already exists for this attribute", 409);
            }
            console.log(error);
            throw new AppError("Failed to update attribute value", 500);
        }
    };

    deleteAttributeValueById = async ({
        attributeValueId,
        shopId,
        queryOptions,
    }: {
        attributeValueId: string;
        shopId: string;
        queryOptions?: QueryOptions;
    }) => {
        const tx = queryOptions?.tx || db;
        try {
            // Scoped existence check first (404 for foreign or missing ids).
            await this.getAttributeValueById(
                queryOptions ? { attributeValueId, shopId, queryOptions } : { attributeValueId, shopId },
            );
            // Restrict: refuse deletion while any variant uses this value.
            const inUse = await tx
                .select({ variantId: productVariantsAttributeValues.productVariantId })
                .from(productVariantsAttributeValues)
                .where(eq(productVariantsAttributeValues.attributeValueId, attributeValueId))
                .limit(1);
            if (inUse.length > 0) {
                throw new AppError("Attribute value is in use by products and cannot be deleted", 409);
            }
            const deleted = await tx
                .delete(attributeValues)
                .where(eq(attributeValues.id, attributeValueId))
                .returning();
            if (!deleted[0]) throw new AppError("Attribute value not found", 404);
            return deleted[0];
        } catch (error) {
            if (error instanceof AppError) throw error;
            console.log(error);
            throw new AppError("Failed to delete attribute value", 500);
        }
    };
}
