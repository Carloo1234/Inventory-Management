import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { shopDetailQueryOptions, variantListSearchSchema, variantsQueryOptions } from "@/lib/queries";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchIcon, ShieldAlertIcon, ScanBarcodeIcon, ImageIcon } from "lucide-react";
import { ListPagination } from "@/components/list-pagination";
import { resolvePublicUrl } from "@/lib/api";

/**
 * Flat variants explorer for `/shops/$shopId/variants` (sidebar: Stock).
 * Variant-level search/sort the grouped products view can't express, plus an
 * exact barcode lookup field for the scanner flow.
 */
export const Route = createFileRoute("/shops/$shopId/variants")({
    validateSearch: variantListSearchSchema,
    loader: async ({ context: { queryClient }, params: { shopId }, location }) => {
        // Same Register-types gap as products/index: parse from location instead.
        const search = variantListSearchSchema.parse(Object.fromEntries(new URLSearchParams(location.searchStr)));
        try {
            await queryClient.query(shopDetailQueryOptions(shopId));
            return await queryClient.query(variantsQueryOptions(shopId, search));
        } catch (error) {
            if (axios.isAxiosError(error) && error.status === 401) {
                throw redirect({ to: "/signin" });
            }
            throw error;
        }
    },
    component: VariantsPageComponent,
});

function VariantsPageComponent() {
    const { shopId } = Route.useParams();
    const search = Route.useSearch();
    const navigate = useNavigate();
    const { data: shop } = useQuery(shopDetailQueryOptions(shopId));
    const { data, isLoading, error } = useQuery(variantsQueryOptions(shopId, search));
    // Same Register-types gap as the loader: one cast, used by all search updates below.
    const goSearch = (next: typeof search) => navigate({ search: next as never });

    const [draft, setDraft] = React.useState(search.search ?? "");
    const [barcodeDraft, setBarcodeDraft] = React.useState(search.barcode ?? "");
    React.useEffect(() => setDraft(search.search ?? ""), [search.search]);
    React.useEffect(() => setBarcodeDraft(search.barcode ?? ""), [search.barcode]);
    React.useEffect(() => {
        const timer = setTimeout(() => {
            const trimmed = draft.trim();
            if (trimmed !== (search.search ?? "")) {
                goSearch({ ...search, search: trimmed || undefined, barcode: undefined, page: 1 });
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [draft, navigate, search]);

    const canRead = shop?.isOwner || shop?.managerPermissions?.includes("product:read") || false;

    const setFilters = (patch: Partial<Omit<typeof search, "page">>) => {
        goSearch({ ...search, ...patch, page: 1 });
    };
    const setPage = (page: number) => goSearch({ ...search, page });

    if (!canRead && shop) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-12 text-center">
                <ShieldAlertIcon className="size-8 text-muted-foreground" />
                <p className="font-medium">You don't have permission to view stock.</p>
            </div>
        );
    }

    if (isLoading && !data) {
        return (
            <div className="flex flex-1 items-center justify-center p-12">
                <Spinner className="size-8" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-12 text-center">
                <ShieldAlertIcon className="size-8 text-muted-foreground" />
                <p className="font-medium">Failed to load variants.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div>
                <h2 className="text-xl font-semibold">Stock</h2>
                <p className="text-sm text-muted-foreground">Every variant, individually sortable and searchable.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-48">
                    <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Search SKU or product..."
                        className="pl-9"
                    />
                </div>
                <form
                    className="relative"
                    onSubmit={(e) => {
                        e.preventDefault();
                        const trimmed = barcodeDraft.trim();
                        goSearch({ ...search, barcode: trimmed || undefined, search: undefined, page: 1 });
                    }}
                >
                    <ScanBarcodeIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={barcodeDraft}
                        onChange={(e) => setBarcodeDraft(e.target.value)}
                        placeholder="Scan barcode..."
                        className="pl-9 w-48"
                    />
                </form>
                <div className="flex items-center gap-2 rounded-2xl border border-transparent bg-muted/50 px-3 py-1.5">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sort</span>
                    <Select
                        value={search.sortBy}
                        onValueChange={(value) => value && setFilters({ sortBy: value as typeof search.sortBy })}
                    >
                        <SelectTrigger className="w-fit border-0 bg-transparent py-1 shadow-none" aria-label="Sort field">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="p-1.5">
                            <SelectItem value="createdAt">Newest</SelectItem>
                            <SelectItem value="price">Price</SelectItem>
                            <SelectItem value="quantity">Quantity</SelectItem>
                            <SelectItem value="sku">SKU</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select
                        value={search.sortOrder}
                        onValueChange={(value) => value && setFilters({ sortOrder: value as typeof search.sortOrder })}
                    >
                        <SelectTrigger className="w-fit border-0 bg-transparent py-1 shadow-none" aria-label="Sort direction">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="p-1.5">
                            <SelectItem value="desc">Descending</SelectItem>
                            <SelectItem value="asc">Ascending</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {(search.barcode || search.search) && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setDraft("");
                            setBarcodeDraft("");
                            goSearch({ ...search, barcode: undefined, search: undefined, page: 1 });
                        }}
                    >
                        Clear
                    </Button>
                )}
            </div>

            {data.items.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
                    <h3 className="text-lg font-semibold mb-1">No variants found</h3>
                    <p className="text-sm text-muted-foreground">Try a different search or barcode.</p>
                </div>
            ) : (
                <div className="rounded-xl border overflow-hidden">
                    <Table className="table-fixed">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-14">Image</TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead className="w-36">SKU</TableHead>
                                <TableHead className="w-32">Barcode</TableHead>
                                <TableHead className="w-24 text-right">Price</TableHead>
                                <TableHead className="w-20 text-right">Stock</TableHead>
                                <TableHead>Attributes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.items.map((variant) => {
                                const cover = variant.images.find((img) => img.position === 0) ?? variant.images[0];
                                return (
                                    <TableRow key={variant.id}>
                                        <TableCell>
                                            {cover ? (
                                                <img
                                                    src={resolvePublicUrl(cover.url)}
                                                    alt={variant.sku}
                                                    className="h-10 w-10 rounded-md border bg-muted object-contain"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted">
                                                    <ImageIcon className="size-4 text-muted-foreground" />
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Link
                                                to="/shops/$shopId/products/$productId"
                                                params={{ shopId, productId: variant.product.id }}
                                                className="font-medium hover:underline"
                                            >
                                                {variant.product.name}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs truncate">{variant.sku}</TableCell>
                                        <TableCell className="font-mono text-xs truncate">{variant.barcode ?? "—"}</TableCell>
                                        <TableCell className="text-right whitespace-nowrap">
                                            ${Number(variant.price).toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant={variant.quantity <= 0 ? "destructive" : "secondary"}>
                                                {variant.quantity}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {variant.variantAttributeValues.map((link) => (
                                                    <Badge
                                                        key={link.attributeValue.id}
                                                        variant="outline"
                                                        className="whitespace-nowrap"
                                                    >
                                                        {link.attributeValue.attributeName.name}: {link.attributeValue.value}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
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
