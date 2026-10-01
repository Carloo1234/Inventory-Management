import { and, asc, count, desc, eq, ilike, inArray, isNull, max, notInArray, or } from "drizzle-orm";
import { db, type DatabaseTransaction, type QueryOptions } from "../../db";
import type z from "zod";
import type {
    createProductSchema,
    productsQuerySchema,
    productVariantsQuerySchema,
    updateProductSchema,
    updateProductVariantSchema,
} from "./products.schema";
import { AppError, FormError } from "../../utils/AppError";
import {
    attributeNames,
    attributeValues,
    productImages,
    products,
    productVariants,
    productVariantsAttributeValues,
} from "../../db/schema";

// Max images per scope (per variant, or the product-shared pool). Frontend
// galleries stay predictable and storage stays bounded.
const MAX_IMAGES_PER_SCOPE = 5;
import { getPgErrorCode } from "../../utils/db-errors";

// Sortable product columns. Variant-level fields (price, quantity) are
// deliberately excluded: a multi-variant product has no single value to sort
// by, and any choice (min/max/first) would be surprising. Sort variants
// instead via the flat getVariants read model below.
const SORTABLE_COLUMNS = {
    name: products.name,
    createdAt: products.createdAt,
    updatedAt: products.updatedAt,
} as const;

export type ProductSortBy = keyof typeof SORTABLE_COLUMNS;

// Flat variant read model: every variant is individually addressable, so
// variant-level fields ARE sortable here. Each row carries its parent
// product identity; barcode lookup powers future scanner/checkout flows.
const SORTABLE_VARIANT_COLUMNS = {
    sku: productVariants.sku,
    price: productVariants.price,
    quantity: productVariants.quantity,
    createdAt: productVariants.createdAt,
} as const;

export type VariantSortBy = keyof typeof SORTABLE_VARIANT_COLUMNS;

// Shared nesting: variants with their attributes + images, product images.
// Image fallback (variant images else shared) is resolved service-side;
// the repository returns both levels raw. Ordered by position (0 = main).
// NOTE: intentionally not `as const` — drizzle's relational types require
// mutable orderBy arrays and reject readonly ones.
const productWithDetails = {
    productVariants: {
        with: {
            images: { orderBy: [asc(productImages.position)] },
            variantAttributeValues: {
                // `as const`: without it this widens to boolean and fails
                // drizzle's relational config type (orderBy above must stay mutable).
                with: { attributeValue: { with: { attributeName: true as const } } },
            },
        },
    },
    images: { orderBy: [asc(productImages.position)] },
};

export class ProductsRepository {
    createProduct = async ({
        data,
        shopId,
        queryOptions,
    }: {
        data: z.infer<typeof createProductSchema>;
        shopId: string;
        queryOptions?: QueryOptions;
    }) => {
        // Honor an outer transaction when composed by a service; otherwise own one.
        // (A hardcoded db.transaction here would break composition on this pool.)
        const run = async (tx: DatabaseTransaction) => {
            try {
                const product = (
                    await tx
                        .insert(products)
                        .values({ shopId, name: data.name, description: data.description })
                        .returning()
                )[0];
                if (!product) throw new AppError("Failed to create root product", 500);

                // Same-shop guard: every attached value must resolve through an
                // attribute name owned by this shop, else cross-shop ids would
                // silently contaminate this shop's variants (400).
                const requestedIds = [...new Set(data.variants.flatMap((v) => v.attributeValueIds))];
                if (requestedIds.length > 0) {
                    const owned = await tx
                        .select({ id: attributeValues.id })
                        .from(attributeValues)
                        .innerJoin(attributeNames, eq(attributeValues.attributeNameId, attributeNames.id))
                        .where(eq(attributeNames.shopId, shopId));
                    const ownedIds = new Set(owned.map((r) => r.id));
                    const foreign = requestedIds.filter((id) => !ownedIds.has(id));
                    if (foreign.length > 0) {
                        // Attributes do not belong to this shop
                        throw new AppError("Attributes not found", 404);
                    }
                }
                // Per-variant conflict reporting: every problem lands on the exact
                // variant index + field that caused it (variants.<i>.sku etc.),
                // thrown as FormError so the frontend can highlight the field.
                const fieldErrors: Record<string, string[]> = {};
                const flag = (index: number, field: "sku" | "barcode", message: string) => {
                    const key = `variants.${index}.${field}`;
                    fieldErrors[key] = [...(fieldErrors[key] ?? []), message];
                };

                // Layer 1: repeats inside this very request (deterministic).
                const indexBySku = new Map<string, number[]>();
                const indexByBarcode = new Map<string, number[]>();
                data.variants.forEach((variant, index) => {
                    indexBySku.set(variant.sku, [...(indexBySku.get(variant.sku) ?? []), index]);
                    if (variant.barcode !== undefined) {
                        indexByBarcode.set(variant.barcode, [...(indexByBarcode.get(variant.barcode) ?? []), index]);
                    }
                });
                for (const [sku, indices] of indexBySku) {
                    if (indices.length > 1) {
                        for (const index of indices) {
                            flag(index, "sku", `SKU "${sku}" is used more than once in this request`);
                        }
                    }
                }
                for (const [barcode, indices] of indexByBarcode) {
                    if (indices.length > 1) {
                        for (const index of indices) {
                            flag(index, "barcode", `Barcode "${barcode}" is used more than once in this request`);
                        }
                    }
                }
                // No throw here: layer 2 runs too, so one response reports
                // BOTH in-request repeats AND database collisions at once.

                // Layer 2: collisions with rows already in this shop. One query
                // for both columns, then mapped back onto variant indices.
                const skus = [...new Set(data.variants.map((v) => v.sku))];
                const barcodes = [...new Set(data.variants.map((v) => v.barcode).filter((b) => b !== undefined))];
                const collisionFilter =
                    barcodes.length > 0
                        ? or(inArray(productVariants.sku, skus), inArray(productVariants.barcode, barcodes))
                        : inArray(productVariants.sku, skus);
                const taken = await tx
                    .select({ sku: productVariants.sku, barcode: productVariants.barcode })
                    .from(productVariants)
                    .where(and(eq(productVariants.shopId, shopId), collisionFilter));
                const takenSkus = new Set(taken.map((r) => r.sku));
                const takenBarcodes = new Set(taken.map((r) => r.barcode).filter((b) => b !== null));
                data.variants.forEach((variant, index) => {
                    if (takenSkus.has(variant.sku)) {
                        flag(index, "sku", `SKU "${variant.sku}" already exists in this shop`);
                    }
                    if (variant.barcode !== undefined && takenBarcodes.has(variant.barcode)) {
                        flag(index, "barcode", `Barcode "${variant.barcode}" already exists in this shop`);
                    }
                });
                if (Object.keys(fieldErrors).length > 0) {
                    throw new FormError("SKU or barcode conflict", 409, {
                        formErrors: [],
                        fieldErrors,
                    });
                }

                const variants = await tx
                    .insert(productVariants)
                    .values(
                        data.variants.map((variantData) => ({
                            productId: product.id,
                            shopId,
                            sku: variantData.sku,
                            barcode: variantData.barcode,
                            price: variantData.price,
                            quantity: variantData.quantity,
                        })),
                    )
                    .returning();
                const bySku = new Map(variants.map((v) => [v.sku, v.id]));

                const linkFields = data.variants.flatMap((variantData) => {
                    const variantId = bySku.get(variantData.sku);
                    if (!variantId) throw new AppError("Failed to create product variants", 500);
                    return [...new Set(variantData.attributeValueIds)].map((attributeValueId) => ({
                        productVariantId: variantId,
                        attributeValueId,
                    }));
                });

                if (linkFields.length > 0) {
                    const variantAttributeValues = await tx
                        .insert(productVariantsAttributeValues)
                        .values(linkFields)
                        .returning();
                    return { product, variants, variantAttributeValues };
                }

                return { product, variants };
            } catch (error) {
                if (error instanceof AppError) throw error;
                // Race backstop: a concurrent request claimed the SKU/barcode
                // between our pre-check and the insert. Named conflicts are
                // handled above; this generic message covers only that window.
                if (getPgErrorCode(error) === "23505") {
                    throw new AppError("SKU or barcode was just taken, please retry", 409);
                }
                console.log(error);
                throw new AppError("Failed to create product.", 500);
            }
        };

        if (queryOptions?.tx) return run(queryOptions.tx);
        return db.transaction((tx) => run(tx));
    };

    getProducts = async ({
        shopId,
        page,
        limit,
        search,
        sortBy,
        sortOrder,
        queryOptions,
    }: {
        shopId: string;
        queryOptions?: QueryOptions;
    } & z.infer<typeof productsQuerySchema>) => {
        const tx = queryOptions?.tx || db;
        try {
            // Clamp defensively: routes validate too, but the repository never
            // trusts its caller with unbounded reads.
            const safePage = Math.max(1, Math.floor(page) || 1);
            const safeLimit = Math.min(Math.max(1, Math.floor(limit) || 20), 100);
            const sortColumn =
                sortBy && sortBy in SORTABLE_COLUMNS ? SORTABLE_COLUMNS[sortBy as ProductSortBy] : products.createdAt;
            const order = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

            const filters = [eq(products.shopId, shopId)];
            if (search && search.trim() !== "") {
                // Escape LIKE wildcards so user input can't widen the match.
                const escaped = search.trim().replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
                filters.push(ilike(products.name, `%${escaped}%`));
            }
            const where = and(...filters);

            // Count and page in parallel: same filters, so totalPages is exact.
            const [countRows, items] = await Promise.all([
                tx.select({ total: count() }).from(products).where(where),
                tx.query.products.findMany({
                    where,
                    with: productWithDetails,
                    orderBy: [order],
                    limit: safeLimit,
                    offset: (safePage - 1) * safeLimit,
                }),
            ]);
            const total = countRows[0]?.total ?? 0;
            return {
                items,
                page: safePage,
                limit: safeLimit,
                total,
                totalPages: Math.ceil(total / safeLimit),
            };
        } catch (error) {
            console.log(error);
            throw new AppError("Failed to fetch products", 500);
        }
    };

    getProductById = async ({
        productId,
        shopId,
        queryOptions,
    }: {
        productId: string;
        shopId: string;
        queryOptions?: QueryOptions;
    }) => {
        const tx = queryOptions?.tx || db;
        try {
            // A product is only addressable within its shop (IDOR guard).
            const product = await tx.query.products.findFirst({
                where: and(eq(products.id, productId), eq(products.shopId, shopId)),
                with: productWithDetails,
            });
            if (!product) throw new AppError("Product not found", 404);
            return product;
        } catch (error) {
            if (error instanceof AppError) throw error;
            console.log(error);
            throw new AppError("Failed to fetch product", 500);
        }
    };

    // id = update, no id = create
    updateProductById = async ({
        productId,
        shopId,
        data,
        queryOptions,
    }: {
        productId: string;
        shopId: string;
        data: z.infer<typeof updateProductSchema>;
        queryOptions?: QueryOptions;
    }) => {
        const run = async (tx: DatabaseTransaction) => {
            try {
                const existing = await tx.query.products.findFirst({
                    where: and(eq(products.id, productId), eq(products.shopId, shopId)),
                    columns: { id: true },
                });
                if (!existing) throw new AppError("Product not found", 404);

                if (data.name !== undefined || data.description !== undefined) {
                    await tx
                        .update(products)
                        .set({
                            ...(data.name !== undefined ? { name: data.name } : {}),
                            ...(data.description !== undefined ? { description: data.description } : {}),
                        })
                        .where(and(eq(products.id, productId), eq(products.shopId, shopId)));
                }

                if (data.variants && data.variants.length > 0) {
                    const entries = data.variants;
                    const updates = entries.filter((v) => v.id !== undefined);
                    const creates = entries.filter((v) => v.id === undefined);

                    const updatingIds = updates.map((v) => v.id as string);
                    const currentRows =
                        updatingIds.length > 0
                            ? await tx
                                  .select({
                                      id: productVariants.id,
                                      sku: productVariants.sku,
                                      barcode: productVariants.barcode,
                                  })
                                  .from(productVariants)
                                  .where(
                                      and(
                                          inArray(productVariants.id, updatingIds),
                                          eq(productVariants.productId, productId),
                                          eq(productVariants.shopId, shopId),
                                      ),
                                  )
                            : [];
                    if (currentRows.length !== updatingIds.length) {
                        throw new AppError("Variant not found", 404);
                    }

                    // Same-shop attribute guard for every value id in the payload.
                    const requestedIds = [...new Set(entries.flatMap((v) => v.attributeValueIds ?? []))];
                    if (requestedIds.length > 0) {
                        const owned = await tx
                            .select({ id: attributeValues.id })
                            .from(attributeValues)
                            .innerJoin(attributeNames, eq(attributeValues.attributeNameId, attributeNames.id))
                            .where(eq(attributeNames.shopId, shopId));
                        const ownedIds = new Set(owned.map((r) => r.id));
                        if (requestedIds.some((id) => !ownedIds.has(id))) {
                            throw new AppError("Attributes not found", 404);
                        }
                    }

                    const fieldErrors: Record<string, string[]> = {};
                    const flag = (index: number, field: "sku" | "barcode" | "price" | "quantity", message: string) => {
                        const key = `variants.${index}.${field}`;
                        fieldErrors[key] = [...(fieldErrors[key] ?? []), message];
                    };
                    const skuIndices = new Map<string, number[]>();
                    const barcodeIndices = new Map<string, number[]>();
                    entries.forEach((variant, index) => {
                        if (variant.sku !== undefined) {
                            skuIndices.set(variant.sku, [...(skuIndices.get(variant.sku) ?? []), index]);
                        }
                        if (variant.barcode !== undefined) {
                            barcodeIndices.set(variant.barcode, [
                                ...(barcodeIndices.get(variant.barcode) ?? []),
                                index,
                            ]);
                        }
                    });

                    const isOwnValue = (index: number, field: "sku" | "barcode", value: string) => {
                        const id = entries[index]?.id;
                        return !!id && currentRows.some((r) => r.id === id && r[field] === value);
                    };
                    for (const [sku, indices] of skuIndices) {
                        const offenders = indices.filter((i) => !isOwnValue(i, "sku", sku));
                        if (offenders.length > 1) {
                            for (const index of offenders) {
                                flag(index, "sku", `SKU "${sku}" is used more than once in this request`);
                            }
                        }
                    }
                    for (const [barcode, indices] of barcodeIndices) {
                        const offenders = indices.filter((i) => !isOwnValue(i, "barcode", barcode));
                        if (offenders.length > 1) {
                            for (const index of offenders) {
                                flag(index, "barcode", `Barcode "${barcode}" is used more than once in this request`);
                            }
                        }
                    }
                    const wantedSkus = [...skuIndices.keys()];
                    const wantedBarcodes = [...barcodeIndices.keys()];
                    const collisionFilter =
                        wantedBarcodes.length > 0
                            ? or(
                                  inArray(productVariants.sku, wantedSkus),
                                  inArray(productVariants.barcode, wantedBarcodes),
                              )
                            : inArray(productVariants.sku, wantedSkus);
                    const taken = await tx
                        .select({ id: productVariants.id, sku: productVariants.sku, barcode: productVariants.barcode })
                        .from(productVariants)
                        .where(and(eq(productVariants.shopId, shopId), collisionFilter));
                    const takenByOther = taken.filter((r) => !updatingIds.includes(r.id));
                    const takenSkuSet = new Set(takenByOther.map((r) => r.sku));
                    const takenBarcodeSet = new Set(takenByOther.map((r) => r.barcode).filter((b) => b !== null));
                    entries.forEach((variant, index) => {
                        if (variant.sku !== undefined && takenSkuSet.has(variant.sku)) {
                            const keeper = currentRows.some((r) => r.id === variant.id && r.sku === variant.sku);
                            if (!keeper) flag(index, "sku", `SKU "${variant.sku}" already exists in this shop`);
                        }
                        if (variant.barcode !== undefined && takenBarcodeSet.has(variant.barcode)) {
                            const keeper = currentRows.some(
                                (r) => r.id === variant.id && r.barcode === variant.barcode,
                            );
                            if (!keeper) {
                                flag(index, "barcode", `Barcode "${variant.barcode}" already exists in this shop`);
                            }
                        }
                    });
                    if (Object.keys(fieldErrors).length > 0) {
                        throw new FormError("SKU or barcode conflict", 409, { formErrors: [], fieldErrors });
                    }

                    // Apply updates (provided fields only).
                    for (const variant of updates) {
                        await tx
                            .update(productVariants)
                            .set({
                                ...(variant.sku !== undefined ? { sku: variant.sku } : {}),
                                ...(variant.barcode !== undefined ? { barcode: variant.barcode } : {}),
                                ...(variant.price !== undefined ? { price: variant.price } : {}),
                                ...(variant.quantity !== undefined ? { quantity: variant.quantity } : {}),
                            })
                            .where(
                                and(
                                    eq(productVariants.id, variant.id as string),
                                    eq(productVariants.productId, productId),
                                    eq(productVariants.shopId, shopId),
                                ),
                            );
                        // Links replaced wholesale when provided; omitted = untouched.
                        if (variant.attributeValueIds !== undefined) {
                            await tx
                                .delete(productVariantsAttributeValues)
                                .where(eq(productVariantsAttributeValues.productVariantId, variant.id as string));
                            const fresh = [...new Set(variant.attributeValueIds)];
                            if (fresh.length > 0) {
                                await tx.insert(productVariantsAttributeValues).values(
                                    fresh.map((attributeValueId) => ({
                                        productVariantId: variant.id as string,
                                        attributeValueId,
                                    })),
                                );
                            }
                        }
                    }

                    creates.forEach((variant) => {
                        const index = entries.indexOf(variant);
                        if (variant.sku === undefined) {
                            flag(index, "sku", "SKU is required for a new variant");
                        }
                        if (variant.price === undefined) {
                            flag(index, "price", "Price is required for a new variant");
                        }
                        if (variant.quantity === undefined) {
                            flag(index, "quantity", "Quantity is required for a new variant");
                        }
                    });
                    if (Object.keys(fieldErrors).length > 0) {
                        throw new FormError("New variant is missing required fields", 400, {
                            formErrors: [],
                            fieldErrors,
                        });
                    }
                    if (creates.length > 0) {
                        const created = await tx
                            .insert(productVariants)
                            .values(
                                creates.map((variant) => ({
                                    productId,
                                    shopId,
                                    sku: variant.sku as string,
                                    barcode: variant.barcode,
                                    price: variant.price as string,
                                    quantity: variant.quantity as number,
                                })),
                            )
                            .returning();
                        const createdBySku = new Map(created.map((v) => [v.sku, v.id]));
                        const links = creates.flatMap((variant) => {
                            const variantId = createdBySku.get(variant.sku as string);
                            if (!variantId) throw new AppError("Failed to create product variants", 500);
                            return [...new Set(variant.attributeValueIds ?? [])].map((attributeValueId) => ({
                                productVariantId: variantId,
                                attributeValueId,
                            }));
                        });
                        if (links.length > 0) {
                            await tx.insert(productVariantsAttributeValues).values(links);
                        }
                    }
                }

                // Fresh read-back so the response reflects the write.
                const refreshed = await tx.query.products.findFirst({
                    where: and(eq(products.id, productId), eq(products.shopId, shopId)),
                    with: productWithDetails,
                });
                if (!refreshed) throw new AppError("Product not found", 404);
                return refreshed;
            } catch (error) {
                if (error instanceof AppError) throw error;
                if (getPgErrorCode(error) === "23505") {
                    throw new AppError("SKU or barcode was just taken, please retry", 409);
                }
                console.log(error);
                throw new AppError("Failed to update product", 500);
            }
        };

        if (queryOptions?.tx) return run(queryOptions.tx);
        return db.transaction((tx) => run(tx));
    };

    getVariants = async ({
        shopId,
        page,
        limit,
        search,
        sortBy,
        sortOrder,
        barcode,
        queryOptions,
    }: {
        shopId: string;
        queryOptions?: QueryOptions;
    } & z.infer<typeof productVariantsQuerySchema>) => {
        const tx = queryOptions?.tx || db;
        try {
            const safePage = Math.max(1, Math.floor(page) || 1);
            const safeLimit = Math.min(Math.max(1, Math.floor(limit) || 20), 100);
            const sortColumn =
                sortBy && sortBy in SORTABLE_VARIANT_COLUMNS
                    ? SORTABLE_VARIANT_COLUMNS[sortBy as VariantSortBy]
                    : productVariants.createdAt;
            const order = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

            const filters = [eq(productVariants.shopId, shopId)];
            if (barcode !== undefined && barcode !== "") {
                // Scanner flow: exact match on one barcode, no wildcards.
                filters.push(eq(productVariants.barcode, barcode));
            } else if (search && search.trim() !== "") {
                // SKU or parent product name, wildcard-escaped like products.
                const escaped = search.trim().replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
                const matches = await tx
                    .select({ id: products.id })
                    .from(products)
                    .where(and(eq(products.shopId, shopId), ilike(products.name, `%${escaped}%`)));
                const productIds = matches.map((r) => r.id);

                if (productIds.length > 0) {
                    const skuOrProduct = or(
                        ilike(productVariants.sku, `%${escaped}%`),
                        inArray(productVariants.productId, productIds),
                    );
                    if (skuOrProduct) filters.push(skuOrProduct);
                } else {
                    filters.push(ilike(productVariants.sku, `%${escaped}%`));
                }
            }
            const where = and(...filters);

            const [countRows, items] = await Promise.all([
                tx.select({ total: count() }).from(productVariants).where(where),
                tx.query.productVariants.findMany({
                    where,
                    with: {
                        product: { columns: { id: true, name: true } },
                        images: { orderBy: [asc(productImages.position)] },
                        variantAttributeValues: {
                            with: { attributeValue: { with: { attributeName: true as const } } },
                        },
                    },
                    orderBy: [order],
                    limit: safeLimit,
                    offset: (safePage - 1) * safeLimit,
                }),
            ]);
            const total = countRows[0]?.total ?? 0;
            return {
                items,
                page: safePage,
                limit: safeLimit,
                total,
                totalPages: Math.ceil(total / safeLimit),
            };
        } catch (error) {
            console.log(error);
            throw new AppError("Failed to fetch variants", 500);
        }
    };

    deleteProductById = async ({
        productId,
        shopId,
        queryOptions,
    }: {
        productId: string;
        shopId: string;
        queryOptions?: QueryOptions;
    }) => {
        const tx = queryOptions?.tx || db;
        try {
            const deleted = await tx
                .delete(products)
                .where(and(eq(products.id, productId), eq(products.shopId, shopId)))
                .returning();
            if (!deleted[0]) throw new AppError("Product not found", 404);
            return deleted[0];
        } catch (error) {
            if (error instanceof AppError) throw error;
            console.log(error);
            throw new AppError("Failed to delete product", 500);
        }
    };

    getVariantById = async ({
        variantId,
        shopId,
        queryOptions,
    }: {
        variantId: string;
        shopId: string;
        queryOptions?: QueryOptions;
    }) => {
        const tx = queryOptions?.tx || db;
        try {
            const variant = await tx.query.productVariants.findFirst({
                where: and(eq(productVariants.id, variantId), eq(productVariants.shopId, shopId)),
                with: {
                    product: { columns: { id: true, name: true } },
                    images: { orderBy: [asc(productImages.position)] },
                    variantAttributeValues: {
                        with: { attributeValue: { with: { attributeName: true as const } } },
                    },
                },
            });
            if (!variant) throw new AppError("Variant not found", 404);
            return variant;
        } catch (error) {
            if (error instanceof AppError) throw error;
            console.log(error);
            throw new AppError("Failed to fetch variant", 500);
        }
    };

    updateVariantById = async ({
        variantId,
        shopId,
        data,
        queryOptions,
    }: {
        variantId: string;
        shopId: string;
        // Full update schema (id included but ignored — identity comes from the URL).
        data: z.infer<typeof updateProductVariantSchema>;
        queryOptions?: QueryOptions;
    }) => {
        const run = async (tx: DatabaseTransaction) => {
            try {
                const current = await tx.query.productVariants.findFirst({
                    where: and(eq(productVariants.id, variantId), eq(productVariants.shopId, shopId)),
                    columns: { id: true, sku: true, barcode: true },
                });
                if (!current) throw new AppError("Variant not found", 404);

                if (data.sku !== undefined && data.sku !== current.sku) {
                    const clash = await tx
                        .select({ id: productVariants.id })
                        .from(productVariants)
                        .where(and(eq(productVariants.shopId, shopId), eq(productVariants.sku, data.sku)))
                        .limit(1);
                    if (clash.length > 0) {
                        throw new FormError("SKU or barcode conflict", 409, {
                            formErrors: [],
                            fieldErrors: { sku: [`SKU "${data.sku}" already exists in this shop`] },
                        });
                    }
                }
                if (data.barcode !== undefined && data.barcode !== current.barcode) {
                    const clash = await tx
                        .select({ id: productVariants.id })
                        .from(productVariants)
                        .where(and(eq(productVariants.shopId, shopId), eq(productVariants.barcode, data.barcode)))
                        .limit(1);
                    if (clash.length > 0) {
                        throw new FormError("SKU or barcode conflict", 409, {
                            formErrors: [],
                            fieldErrors: { barcode: [`Barcode "${data.barcode}" already exists in this shop`] },
                        });
                    }
                }

                // Same-shop attribute guard when links are replaced.
                if (data.attributeValueIds !== undefined) {
                    const wanted = [...new Set(data.attributeValueIds)];
                    if (wanted.length > 0) {
                        const owned = await tx
                            .select({ id: attributeValues.id })
                            .from(attributeValues)
                            .innerJoin(attributeNames, eq(attributeValues.attributeNameId, attributeNames.id))
                            .where(eq(attributeNames.shopId, shopId));
                        const ownedIds = new Set(owned.map((r) => r.id));
                        if (wanted.some((id) => !ownedIds.has(id))) {
                            throw new AppError("Attributes not found", 404);
                        }
                    }
                }

                await tx
                    .update(productVariants)
                    .set({
                        ...(data.sku !== undefined ? { sku: data.sku } : {}),
                        ...(data.barcode !== undefined ? { barcode: data.barcode } : {}),
                        ...(data.price !== undefined ? { price: data.price } : {}),
                        ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
                    })
                    .where(and(eq(productVariants.id, variantId), eq(productVariants.shopId, shopId)));

                if (data.attributeValueIds !== undefined) {
                    await tx
                        .delete(productVariantsAttributeValues)
                        .where(eq(productVariantsAttributeValues.productVariantId, variantId));
                    const fresh = [...new Set(data.attributeValueIds)];
                    if (fresh.length > 0) {
                        await tx
                            .insert(productVariantsAttributeValues)
                            .values(
                                fresh.map((attributeValueId) => ({ productVariantId: variantId, attributeValueId })),
                            );
                    }
                }

                const refreshed = await tx.query.productVariants.findFirst({
                    where: and(eq(productVariants.id, variantId), eq(productVariants.shopId, shopId)),
                    with: {
                        product: { columns: { id: true, name: true } },
                        images: { orderBy: [asc(productImages.position)] },
                        variantAttributeValues: {
                            with: { attributeValue: { with: { attributeName: true as const } } },
                        },
                    },
                });
                if (!refreshed) throw new AppError("Variant not found", 404);
                return refreshed;
            } catch (error) {
                if (error instanceof AppError) throw error;
                if (getPgErrorCode(error) === "23505") {
                    throw new AppError("SKU or barcode was just taken, please retry", 409);
                }
                console.log(error);
                throw new AppError("Failed to update variant", 500);
            }
        };

        if (queryOptions?.tx) return run(queryOptions.tx);
        return db.transaction((tx) => run(tx));
    };

    deleteVariantById = async ({
        variantId,
        shopId,
        queryOptions,
    }: {
        variantId: string;
        shopId: string;
        queryOptions?: QueryOptions;
    }) => {
        const run = async (tx: DatabaseTransaction) => {
            try {
                const current = await tx.query.productVariants.findFirst({
                    where: and(eq(productVariants.id, variantId), eq(productVariants.shopId, shopId)),
                    columns: { id: true, productId: true },
                });
                if (!current) throw new AppError("Variant not found", 404);

                const siblings = await tx
                    .select({ id: productVariants.id })
                    .from(productVariants)
                    .where(and(eq(productVariants.productId, current.productId), eq(productVariants.shopId, shopId)));
                if (siblings.length <= 1) {
                    throw new AppError("Cannot delete the last variant of a product, delete the product instead", 400);
                }

                const deleted = await tx
                    .delete(productVariants)
                    .where(and(eq(productVariants.id, variantId), eq(productVariants.shopId, shopId)))
                    .returning();
                if (!deleted[0]) throw new AppError("Variant not found", 404);
                return deleted[0];
            } catch (error) {
                if (error instanceof AppError) throw error;
                console.log(error);
                throw new AppError("Failed to delete variant", 500);
            }
        };

        if (queryOptions?.tx) return run(queryOptions.tx);
        return db.transaction((tx) => run(tx));
    };

    addProductImage = async ({
        shopId,
        productId,
        variantId,
        url,
        queryOptions,
    }: {
        shopId: string;
        productId: string;
        variantId?: string;
        url: string;
        queryOptions?: QueryOptions;
    }) => {
        const tx = queryOptions?.tx || db;
        try {
            // Product must belong to this shop (404 otherwise).
            const product = await tx.query.products.findFirst({
                where: and(eq(products.id, productId), eq(products.shopId, shopId)),
                columns: { id: true },
            });
            if (!product) throw new AppError("Product not found", 404);

            if (variantId !== undefined) {
                const variant = await tx.query.productVariants.findFirst({
                    where: and(
                        eq(productVariants.id, variantId),
                        eq(productVariants.productId, productId),
                        eq(productVariants.shopId, shopId),
                    ),
                    columns: { id: true },
                });
                if (!variant) throw new AppError("Variant not found", 404);
            }

            const scopeFilter =
                variantId !== undefined
                    ? and(eq(productImages.variantId, variantId), eq(productImages.shopId, shopId))
                    : and(isNull(productImages.variantId), eq(productImages.productId, productId));
            const countRows = await tx.select({ count: count() }).from(productImages).where(scopeFilter);
            if ((countRows[0]?.count ?? 0) >= MAX_IMAGES_PER_SCOPE) {
                throw new AppError(`A maximum of ${MAX_IMAGES_PER_SCOPE} images is allowed here`, 400);
            }

            const maxRows = await tx
                .select({ highest: max(productImages.position) })
                .from(productImages)
                .where(scopeFilter);
            const highest = maxRows[0]?.highest ?? -1;
            const created = (
                await tx
                    .insert(productImages)
                    .values({ shopId, productId, variantId, url, position: highest + 1 })
                    .returning()
            )[0];
            if (!created) throw new AppError("Failed to add image", 500);
            return created;
        } catch (error) {
            if (error instanceof AppError) throw error;
            console.log(error);
            throw new AppError("Failed to add image", 500);
        }
    };

    getProductImages = async ({
        productId,
        shopId,
        queryOptions,
    }: {
        productId: string;
        shopId: string;
        queryOptions?: QueryOptions;
    }) => {
        const tx = queryOptions?.tx || db;
        try {
            const product = await tx.query.products.findFirst({
                where: and(eq(products.id, productId), eq(products.shopId, shopId)),
                columns: { id: true },
            });
            if (!product) throw new AppError("Product not found", 404);

            const images = await tx.query.productImages.findMany({
                where: and(eq(productImages.productId, productId), eq(productImages.shopId, shopId)),
                orderBy: [asc(productImages.position)],
            });
            return images;
        } catch (error) {
            if (error instanceof AppError) throw error;
            console.log(error);
            throw new AppError("Failed to fetch images", 500);
        }
    };

    deleteProductImageById = async ({
        imageId,
        shopId,
        queryOptions,
    }: {
        imageId: string;
        shopId: string;
        queryOptions?: QueryOptions;
    }) => {
        const tx = queryOptions?.tx || db;
        try {
            const deleted = await tx
                .delete(productImages)
                .where(and(eq(productImages.id, imageId), eq(productImages.shopId, shopId)))
                .returning();
            if (!deleted[0]) throw new AppError("Image not found", 404);
            return deleted[0];
        } catch (error) {
            if (error instanceof AppError) throw error;
            console.log(error);
            throw new AppError("Failed to delete image", 500);
        }
    };
}
