"use client";

import * as React from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { useNavigate, useParams } from "@tanstack/react-router";
import type { Shops } from "@/lib/queries";
import { AddShopDialog } from "@/components/add-shop-dialog";

/**
 * ShopSwitcher component allowing users to switch between their shops or open the add shop dialog.
 */
export function ShopSwitcher({ shops }: { shops: Shops | undefined }) {
    const navigate = useNavigate();
    const params = useParams({ strict: false }) as { shopId?: string };
    const { isMobile } = useSidebar();
    const [isAddShopOpen, setIsAddShopOpen] = React.useState(false);

    // Determine currently active shop based on URL params or default to first shop
    const activeShop = React.useMemo(() => {
        if (!shops || shops.length === 0) return null;
        if (params.shopId) {
            const found = shops.find((s) => s.id === params.shopId);
            if (found) return found;
        }
        navigate({ to: "/shops/$shopId", params: { shopId: shops[0].id } });
        return shops[0];
    }, [shops, params.shopId]);

    return (
        <>
            <SidebarMenu>
                <SidebarMenuItem>
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <SidebarMenuButton
                                    size="lg"
                                    className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
                                />
                            }
                        >
                            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                                <i className="fa-solid fa-shop"></i>
                            </div>
                            {activeShop ? (
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-medium">{activeShop.name}</span>
                                    <div className="text-muted-foreground text-xs">
                                        {activeShop.isOwner ? "Owner" : "Manager"}
                                    </div>
                                </div>
                            ) : (
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-medium">No shops found</span>
                                    <div className="text-muted-foreground text-xs">Create your first shop</div>
                                </div>
                            )}
                            <ChevronsUpDownIcon className="ml-auto size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                            align="start"
                            side={isMobile ? "bottom" : "right"}
                            sideOffset={4}
                        >
                            <DropdownMenuGroup>
                                <DropdownMenuLabel className="text-xs text-muted-foreground">Shops</DropdownMenuLabel>
                                {shops?.map((shop) => (
                                    <DropdownMenuItem
                                        key={shop.id}
                                        onClick={() => {
                                            navigate({ to: "/shops/$shopId", params: { shopId: shop.id } });
                                        }}
                                        className="gap-2 p-2 cursor-pointer"
                                    >
                                        <div className="flex size-6 items-center justify-center rounded-sm border">
                                            <i className="fa-solid fa-shop text-xs"></i>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{shop.name}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {shop.isOwner ? "Owner" : "Manager"}
                                            </span>
                                        </div>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                                <DropdownMenuItem
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setIsAddShopOpen(true);
                                    }}
                                    className="gap-2 p-2 cursor-pointer"
                                >
                                    <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                                        <PlusIcon className="size-4" />
                                    </div>
                                    <div className="font-medium text-muted-foreground">Add shop</div>
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </SidebarMenuItem>
            </SidebarMenu>

            {/* Dialog modal for creating a new shop */}
            <AddShopDialog open={isAddShopOpen} onOpenChange={setIsAddShopOpen} />
        </>
    );
}
