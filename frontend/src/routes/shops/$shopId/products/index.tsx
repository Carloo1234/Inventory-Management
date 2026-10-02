import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { productListSearchSchema, productsQueryOptions, shopDetailQueryOptions } from "@/lib/queries";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { PlusIcon, SearchIcon, ShieldAlertIcon } from "lucide-react";
import { ListPagination } from "@/components/list-pagination";
import { resolvePublicUrl } from "@/lib/api";

/**
 * Products list page for `/shops/$shopId/products`.
 * List state (page/limit/search/sort) lives in URL search params so refresh,
 * back-button and sharing all work. Data prefetched with queryClient.query().
 */
export const Route = createFileRoute("/shops/$shopId/products/")({
    validateSearch: productListSearchSchema,
    loader: async ({ context: { queryClient }, params: { shopId }, location }) => {
        // NOTE: search read from location + parsed (not loader-context destructure):
        // this router version doesn't propagate validateSearch into Register-based
        // loader/navigate types. Runtime validation still runs via validateSearch.
        const search = productListSearchSchema.parse(Object.fromEntries(new URLSearchParams(location.searchStr)));
        try {
            await queryClient.query(shopDetailQueryOptions(shopId));
            return await queryClient.query(productsQueryOptions(shopId, search));
        } catch (error) {
            if (axios.isAxiosError(error) && error.status === 401) {
                throw redirect({ to: "/signin" });
            }
            throw error;
        }
    },
    component: ProductsPageComponent,
});

function variantSummary(product: { productVariants: { price: string; quantity: number }[] }) {
    const prices = product.productVariants.map((v) => Number(v.price));
    const stock = product.productVariants.reduce((sum, v) => sum + v.quantity, 0);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return { priceLabel: min === max ? `$${min.toFixed(2)}` : `$${min.toFixed(2)} – $${max.toFixed(2)}`, stock };
}

function ProductsPageComponent() {
    const { shopId } = Route.useParams();
    const search = Route.useSearch();
    const navigate = useNavigate();
    const { data: shop } = useQuery(shopDetailQueryOptions(shopId));
    const { data, isLoading, error } = useQuery(productsQueryOptions(shopId, search));
    // Same Register-types gap as the loader: one cast, used by all search updates below.
    const goSearch = (next: typeof search) => navigate({ search: next as never });

    // Debounced search input: local state mirrors the URL, commits on pause.
    const [draft, setDraft] = React.useState(search.search ?? "");
    React.useEffect(() => setDraft(search.search ?? ""), [search.search]);
    React.useEffect(() => {
        const timer = setTimeout(() => {
            const trimmed = draft.trim();
            if (trimmed !== (search.search ?? "")) {
                goSearch({ ...search, search: trimmed || undefined, page: 1 });
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [draft, navigate, search]);

    const canCreate = shop?.isOwner || shop?.managerPermissions?.includes("product:create") || false;

    // Page changes keep the page; every other filter change restarts at page 1.
    const setPage = (page: number) => goSearch({ ...search, page });
    const setFilters = (patch: Partial<Omit<typeof search, "page">>) => {
        goSearch({ ...search, ...patch, page: 1 });
    };

    if (isLoading && !data) {
        return (
            <div className="flex flex-1 items-center justify-center p-12">
                <Spinner className="size-8" />
            </div>
        );
    }

    if (error || !data) {
        const status = axios.isAxiosError(error) ? error.status : undefined;
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-12 text-center">
                <ShieldAlertIcon className="size-8 text-muted-foreground" />
                <p className="font-medium">
                    {status === 403 || status === 404
                        ? "You don't have permission to view products."
                        : "Failed to load products."}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h2 className="text-xl font-semibold">Products</h2>
                    <p className="text-sm text-muted-foreground">
                        {shop?.name ?? "Shop"} catalog, grouped by product.
                    </p>
                </div>
                {canCreate && (
                    <Button render={<Link to="/shops/$shopId/products/new" params={{ shopId }} />} className="gap-2 shrink-0">
                        <PlusIcon className="size-4" />
                        <span>New Product</span>
                    </Button>
                )}
            </div>

            {/* Toolbar: search + sort (variant fields excluded by backend whitelist) */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-48">
                    <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Search products..."
                        className="pl-9"
                    />
                </div>
                <Select
                    value={search.sortBy}
                    onValueChange={(value) => value && setFilters({ sortBy: value as typeof search.sortBy })}
                >
                    <SelectTrigger className="w-fit py-2">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="p-1.5">
                        <SelectItem value="createdAt">Newest</SelectItem>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="updatedAt">Recently updated</SelectItem>
                    </SelectContent>
                </Select>
                <Select
                    value={search.sortOrder}
                    onValueChange={(value) => value && setFilters({ sortOrder: value as typeof search.sortOrder })}
                >
                    <SelectTrigger className="w-fit py-2">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="p-1.5">
                        <SelectItem value="desc">Descending</SelectItem>
                        <SelectItem value="asc">Ascending</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {data.items.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
                    <h3 className="text-lg font-semibold mb-1">No products found</h3>
                    <p className="text-sm text-muted-foreground">
                        {search.search ? "Try a different search." : "Create your first product to get started."}
                    </p>
                </div>
            ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {data.items.map((product) => {
                        const summary = variantSummary(product);
                        const mainImage = product.images.find((img) => img.position === 0) ?? product.images[0];
                        return (
                            <Link
                                key={product.id}
                                to="/shops/$shopId/products/$productId"
                                params={{ shopId, productId: product.id }}
                            >
                                <Card className="h-full transition-colors hover:border-primary/50">
                                    {mainImage && (
                                        <div className="overflow-hidden rounded-t-xl bg-muted">
                                            <img
                                                src={resolvePublicUrl(mainImage.url)}
                                                alt={product.name}
                                                className="aspect-video w-full object-contain"
                                                loading="lazy"
                                            />
                                        </div>
                                    )}
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">{product.name}</CardTitle>
                                        <CardDescription>
                                            {product.productVariants.length} variant
                                            {product.productVariants.length === 1 ? "" : "s"}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex items-center justify-between gap-2">
                                        <span className="font-semibold">{summary.priceLabel}</span>
                                        <Badge variant={summary.stock <= 0 ? "destructive" : "secondary"}>
                                            {summary.stock} in stock
                                        </Badge>
                                    </CardContent>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            )}

            <ListPagination
                page={data.page}
                totalPages={data.totalPages}
                total={data.total}
                limit={data.limit}
                onPageChange={setPage}
                onLimitChange={(limit) => setFilters({ limit })}
            />
        </div>
    );
}
