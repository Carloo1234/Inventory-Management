"use client";

import * as React from "react";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { ChevronsUpDownIcon, PlusIcon } from "lucide-react";

export function ShopSwitcher({
    shops,
}: {
    shops:
        | {
              id: string;
              name: string;
              createdAt: string;
              updatedAt: string;
              ownerId: string;
              softDelete: boolean;
              isOwner: boolean;
              managerPermissions: string[] | null;
          }[]
        | undefined;
}) {
    const { isMobile } = useSidebar();
    const [activeshop, setActiveshop] = React.useState(() => (shops ? shops[0] : null));
    // if (!activeshop) {
    //     return null;
    // }
    return (
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
                        {activeshop ? (
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-medium">{activeshop.name}</span>
                                <div className="text-muted-foreground text-sm">
                                    {activeshop.isOwner ? "Owner" : "Manager"}
                                </div>
                            </div>
                        ) : (
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-medium">Click to create a shop</span>
                                <div className="text-muted-foreground text-sm">You don't have shops </div>
                            </div>
                        )}
                        <ChevronsUpDownIcon className="ml-auto" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-fit"
                        align="start"
                        side={isMobile ? "bottom" : "right"}
                        sideOffset={4}
                    >
                        <DropdownMenuGroup>
                            <DropdownMenuLabel className="text-xs text-muted-foreground">Shops</DropdownMenuLabel>
                            {shops?.map((shop, index) => (
                                <DropdownMenuItem
                                    key={shop.id}
                                    onClick={() => setActiveshop(shop)}
                                    className="flex flex-col items-start p-2"
                                >
                                    <div className="flex flex-col items-start">
                                        <div>{shop.name}</div>
                                        <div className="text-muted-foreground text-sm">
                                            {shop.isOwner ? "Owner" : "Manager"}
                                        </div>
                                    </div>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem className="gap-2 p-2">
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
    );
}
