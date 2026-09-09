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
