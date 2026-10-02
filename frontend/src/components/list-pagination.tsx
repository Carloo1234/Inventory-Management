import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

interface ListPaginationProps {
    page: number;
    totalPages: number;
    total: number;
    limit: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
}

/**
 * Shared pagination footer: prev/next, "page X of Y", total count, page-size picker.
 * Parent owns state (usually URL search params) and refetches on change.
 */
export function ListPagination({ page, totalPages, total, limit, onPageChange, onLimitChange }: ListPaginationProps) {
    const safeTotalPages = Math.max(totalPages, 1);
    return (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <p className="text-sm text-muted-foreground">
                {total} item{total === 1 ? "" : "s"} · page {Math.min(page, safeTotalPages)} of {safeTotalPages}
            </p>
            <div className="flex items-center gap-2">
                <Select value={String(limit)} onValueChange={(value) => onLimitChange(Number(value) || 20)}>
                    <SelectTrigger size="sm" className="w-fit">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {[12, 20, 50].map((size) => (
                            <SelectItem key={size} value={String(size)}>
                                {size} / page
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                    aria-label="Previous page"
                >
                    <ChevronLeftIcon className="size-4" />
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= safeTotalPages}
                    onClick={() => onPageChange(page + 1)}
                    aria-label="Next page"
                >
                    <ChevronRightIcon className="size-4" />
                </Button>
            </div>
        </div>
    );
}
