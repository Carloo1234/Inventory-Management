import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";
import z from "zod";

/**
 * User schema and query options for fetching authenticated user details.
 */
export const userSchema = z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string(),
    shopLimit: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export type User = z.infer<typeof userSchema>;

async function fetchUser(): Promise<User> {
    const response = await api.get("/auth/me");
    const user = response.data.data.user;
    return userSchema.parse(user);
}

export const userQueryOptions = queryOptions({
    queryKey: ["user", "me"],
    queryFn: fetchUser,
});

/**
 * Shop schema and query options for fetching user shops and shop details.
 */
export const shopSchema = z.object({
    id: z.string(),
    name: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    ownerId: z.string(),
    softDelete: z.boolean(),
    isOwner: z.boolean(),
    managerPermissions: z.array(z.string()).nullable(),
});

export const shopsSchema = z.array(shopSchema);
export type Shop = z.infer<typeof shopSchema>;
export type Shops = z.infer<typeof shopsSchema>;

async function fetchShops(): Promise<Shops> {
    const response = await api.get("/shops/my-shops");
    if (!response.validResponse) throw Error("Data sent from server is invalid");
    const shops = response.validResponse.data.shops;
    return shopsSchema.parse(shops);
}

export const shopsQueryOptions = queryOptions({
    queryKey: ["shops", "me"],
    queryFn: fetchShops,
});

async function fetchShopDetail(shopId: string): Promise<Shop> {
    const response = await api.get(`/shops/${shopId}`);
    if (!response.validResponse) throw Error("Invalid shop data received");
    return shopSchema.parse(response.validResponse.data.shopData);
}

export const shopDetailQueryOptions = (shopId: string) =>
    queryOptions({
        queryKey: ["shop", shopId],
        queryFn: () => fetchShopDetail(shopId),
    });

/**
 * Role schema and query options for shop role management.
 * Backend returns rows: { id, name, permissions[], shopId, createdAt }.
 */
export const roleSchema = z.object({
    id: z.string(),
    name: z.string(),
    permissions: z.array(z.string()),
    shopId: z.string(),
    createdAt: z.string(),
});

export const rolesSchema = z.array(roleSchema);
export type Role = z.infer<typeof roleSchema>;
export type Roles = z.infer<typeof rolesSchema>;

async function fetchRoles(shopId: string): Promise<Roles> {
    const response = await api.get(`/shops/${shopId}/roles`);
    if (!response.validResponse) throw Error("Invalid roles data received");
    return rolesSchema.parse(response.validResponse.data);
}

export const rolesQueryOptions = (shopId: string) =>
    queryOptions({
        queryKey: ["roles", shopId],
        queryFn: () => fetchRoles(shopId),
    });

/**
 * Permission catalog from the live backend endpoint
 * (GET /shops/:shopId/roles/permissions), kept in sync automatically.
 * Backend shape: { KEY: { value, friendlyName } }.
 */
export const permissionEntrySchema = z.object({
    key: z.string(),
    value: z.string(),
    friendlyName: z.string(),
});

export type PermissionEntry = z.infer<typeof permissionEntrySchema>;

async function fetchPermissions(shopId: string): Promise<PermissionEntry[]> {
    const response = await api.get(`/shops/${shopId}/roles/permissions`);
    if (!response.validResponse) throw Error("Invalid permissions data received");
    const record = z.record(z.string(), z.object({ value: z.string(), friendlyName: z.string() })).parse(
        response.validResponse.data,
    );
    return Object.entries(record).map(([key, entry]) => ({ key, ...entry }));
}

export const permissionsQueryOptions = (shopId: string) =>
    queryOptions({
        queryKey: ["permissions", shopId],
        queryFn: () => fetchPermissions(shopId),
        // Permission catalog rarely changes within a session.
        staleTime: 5 * 60 * 1000,
    });

/**
 * Groups permission values by namespace prefix ("shop", "product", ...).
 * Powers the grouped checkbox UI with per-group select-all toggles.
 */
export function groupPermissions(permissions: PermissionEntry[]): { namespace: string; items: PermissionEntry[] }[] {
    const groups = new Map<string, PermissionEntry[]>();
    for (const entry of permissions) {
        const namespace = entry.value.split(":")[0] ?? "other";
        const list = groups.get(namespace);
        if (list) list.push(entry);
        else groups.set(namespace, [entry]);
    }
    return [...groups.entries()].map(([namespace, items]) => ({ namespace, items }));
}

/**
 * Invite schemas and query options.
 * Shop list rows: { id, invitedBy, invitedUser, role, shopId, createdAt, updatedAt, expiresAt }.
 * Personal inbox rows add shop: { id, name }.
 */
const inviteUserSchema = z.object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

const inviteRoleSchema = z.object({
    id: z.string(),
    name: z.string(),
    permissions: z.array(z.string()),
    createdAt: z.string(),
});

export const inviteSchema = z.object({
    id: z.string(),
    invitedBy: inviteUserSchema,
    invitedUser: inviteUserSchema,
    role: inviteRoleSchema,
    shopId: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    expiresAt: z.string(),
});

export const myInviteSchema = inviteSchema.extend({
    shop: z.object({ id: z.string(), name: z.string() }),
});

export const invitesSchema = z.array(inviteSchema);
export const myInvitesSchema = z.array(myInviteSchema);
export type Invite = z.infer<typeof inviteSchema>;
export type MyInvite = z.infer<typeof myInviteSchema>;

async function fetchInvites(shopId: string): Promise<Invite[]> {
    const response = await api.get(`/shops/${shopId}/invites`);
    if (!response.validResponse) throw Error("Invalid invites data received");
    return invitesSchema.parse(response.validResponse.data);
}

export const invitesQueryOptions = (shopId: string) =>
    queryOptions({
        queryKey: ["invites", shopId],
        queryFn: () => fetchInvites(shopId),
    });

async function fetchMyInvites(): Promise<MyInvite[]> {
    const response = await api.get("/invites/mine");
    if (!response.validResponse) throw Error("Invalid inbox data received");
    return myInvitesSchema.parse(response.validResponse.data);
}

export const myInvitesQueryOptions = queryOptions({
    queryKey: ["invites", "mine"],
    queryFn: fetchMyInvites,
});

/**
 * Manager schemas and query options.
 * Rows: { managerId, user, role, invitedBy, createdAt }.
 */
export const managerSchema = z.object({
    managerId: z.string(),
    user: inviteUserSchema,
    role: inviteRoleSchema.omit({ createdAt: true }),
    invitedBy: inviteUserSchema.pick({ id: true, email: true, name: true }),
    createdAt: z.string(),
});

export const managersSchema = z.array(managerSchema);
export type Manager = z.infer<typeof managerSchema>;

async function fetchManagers(shopId: string): Promise<Manager[]> {
    const response = await api.get(`/shops/${shopId}/managers`);
    if (!response.validResponse) throw Error("Invalid managers data received");
    return managersSchema.parse(response.validResponse.data);
}

export const managersQueryOptions = (shopId: string) =>
    queryOptions({
        queryKey: ["managers", shopId],
        queryFn: () => fetchManagers(shopId),
    });

/**
 * Role presets served live by the backend (GET /roles/permission-presets),
 * so bundles never drift from the permission catalog.
 */
export const rolePresetSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    permissions: z.array(z.string()),
});

export type RolePreset = z.infer<typeof rolePresetSchema>;

async function fetchRolePresets(shopId: string): Promise<RolePreset[]> {
    const response = await api.get(`/shops/${shopId}/roles/permission-presets`);
    if (!response.validResponse) throw Error("Invalid presets data received");
    return z.array(rolePresetSchema).parse(response.validResponse.data);
}

export const rolePresetsQueryOptions = (shopId: string) =>
    queryOptions({
        queryKey: ["permission-presets", shopId],
        queryFn: () => fetchRolePresets(shopId),
        staleTime: 5 * 60 * 1000,
    });

/**
 * Products, variants, attributes and images.
 * Backend returns raw drizzle rows (timestamps arrive as ISO strings over JSON).
 * Price is a STRING end-to-end (Postgres numeric serializes as string).
 */
export const productImageSchema = z.object({
    id: z.string(),
    shopId: z.string(),
    productId: z.string(),
    variantId: z.string().nullable(),
    url: z.string(),
    position: z.number(),
    createdAt: z.string(),
});

const variantAttributeSchema = z.object({
    attributeValue: z.object({
        id: z.string(),
        value: z.string(),
        attributeNameId: z.string().optional(),
        attributeName: z.object({ id: z.string(), name: z.string() }),
    }),
});

export const variantSchema = z.object({
    id: z.string(),
    productId: z.string(),
    shopId: z.string(),
    sku: z.string(),
    barcode: z.string().nullable(),
    price: z.string(),
    quantity: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
    images: z.array(productImageSchema),
    variantAttributeValues: z.array(variantAttributeSchema),
});

export const productSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    shopId: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    productVariants: z.array(variantSchema),
    images: z.array(productImageSchema),
});

export const flatVariantSchema = variantSchema.extend({
    product: z.object({ id: z.string(), name: z.string() }),
});

export type ProductImage = z.infer<typeof productImageSchema>;
export type Variant = z.infer<typeof variantSchema>;
export type Product = z.infer<typeof productSchema>;
export type FlatVariant = z.infer<typeof flatVariantSchema>;

const pagedSchema = <T extends z.ZodTypeAny>(item: T) =>
    z.object({
        items: z.array(item),
        page: z.number(),
        limit: z.number(),
        total: z.number(),
        totalPages: z.number(),
    });

export interface ProductListParams {
    page: number;
    limit: number;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
}

export interface VariantListParams extends ProductListParams {
    barcode?: string;
}

async function fetchProducts(shopId: string, params: ProductListParams) {
    const query = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
        sortBy: params.sortBy ?? "createdAt",
        sortOrder: params.sortOrder ?? "desc",
        ...(params.search ? { search: params.search } : {}),
    });
    const response = await api.get(`/shops/${shopId}/products?${query}`);
    if (!response.validResponse) throw Error("Invalid products data received");
    return pagedSchema(productSchema).parse(response.validResponse.data);
}

export const productsQueryOptions = (shopId: string, params: ProductListParams) =>
    queryOptions({
        queryKey: ["products", shopId, params],
        queryFn: () => fetchProducts(shopId, params),
        placeholderData: (previous) => previous,
    });

export const productDetailQueryOptions = (shopId: string, productId: string) =>
    queryOptions({
        queryKey: ["product", shopId, productId],
        queryFn: async () => {
            const response = await api.get(`/shops/${shopId}/products/${productId}`);
            if (!response.validResponse) throw Error("Invalid product data received");
            return productSchema.parse(response.validResponse.data);
        },
    });

async function fetchVariants(shopId: string, params: VariantListParams) {
    const query = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
        sortBy: params.sortBy ?? "createdAt",
        sortOrder: params.sortOrder ?? "desc",
        ...(params.search ? { search: params.search } : {}),
        ...(params.barcode ? { barcode: params.barcode } : {}),
    });
    const response = await api.get(`/shops/${shopId}/products/variants?${query}`);
    if (!response.validResponse) throw Error("Invalid variants data received");
    return pagedSchema(flatVariantSchema).parse(response.validResponse.data);
}

export const variantsQueryOptions = (shopId: string, params: VariantListParams) =>
    queryOptions({
        queryKey: ["variants", shopId, params],
        queryFn: () => fetchVariants(shopId, params),
        placeholderData: (previous) => previous,
    });

/**
 * Shop attributes with embedded values (one fetch feeds all pickers).
 */
export const attributeSchema = z.object({
    id: z.string(),
    name: z.string(),
    shopId: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    values: z.array(
        z.object({
            id: z.string(),
            value: z.string(),
            attributeNameId: z.string().optional(),
            createdAt: z.string(),
            updatedAt: z.string(),
        }),
    ),
});

export type ShopAttribute = z.infer<typeof attributeSchema>;

export const attributesQueryOptions = (shopId: string) =>
    queryOptions({
        queryKey: ["attributes", shopId],
        queryFn: async () => {
            const response = await api.get(`/shops/${shopId}/attributes`);
            if (!response.validResponse) throw Error("Invalid attributes data received");
            return z.array(attributeSchema).parse(response.validResponse.data);
        },
        staleTime: 5 * 60 * 1000,
    });

/**
 * URL search-param contracts for the inventory routes (validateSearch).
 * Defaults mirror the backend (page 1, limit 20, newest first).
 */
export const productListSearchSchema = z.object({
    page: z.coerce.number().int().min(1).default(1).catch(1),
    limit: z.coerce.number().int().min(1).max(100).default(20).catch(20),
    search: z.string().optional(),
    sortBy: z.enum(["name", "createdAt", "updatedAt"]).default("createdAt").catch("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc").catch("desc"),
});

export const variantListSearchSchema = z.object({
    page: z.coerce.number().int().min(1).default(1).catch(1),
    limit: z.coerce.number().int().min(1).max(100).default(20).catch(20),
    search: z.string().optional(),
    sortBy: z.enum(["sku", "price", "quantity", "createdAt"]).default("createdAt").catch("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc").catch("desc"),
    barcode: z.string().optional(),
});

/**
 * PATCH /roles/:roleId returns { role, affectedManagers } instead of a bare row.
 */
export const roleUpdateResultSchema = z.object({
    role: roleSchema,
    affectedManagers: z.object({
        count: z.number(),
        managerIds: z.array(z.string()),
    }),
});

export type RoleUpdateResult = z.infer<typeof roleUpdateResultSchema>;
