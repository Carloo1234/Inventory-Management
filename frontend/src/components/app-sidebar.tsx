"use client";

import * as React from "react";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { ShopSwitcher } from "@/components/shop-switcher";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarRail,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { TerminalSquareIcon, BotIcon, UsersIcon, BellIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { myInvitesQueryOptions, shopsQueryOptions, userQueryOptions } from "@/lib/queries";
import { Link, useParams } from "@tanstack/react-router";

/**
 * AppSidebar: shop switcher, main navigation (Dashboard, Inventory, Team),
 * personal invites inbox link, and user footer.
 * Dead placeholder groups (Sales, Shortcuts, Analytics, Settings) were removed.
 */
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const { data: shops } = useQuery(shopsQueryOptions);
    const { data: user } = useQuery(userQueryOptions);
    const { data: myInvites } = useQuery(myInvitesQueryOptions);
    const params = useParams({ strict: false }) as { shopId?: string };
    const currentShopId = params.shopId || (shops && shops[0]?.id);
    const shopBase = currentShopId ? `/shops/${currentShopId}` : "/shops";

    // Main navigation: flat links where possible, dropdowns only for
    // genuinely grouped sections (Inventory, Team).
    const navMain = [
        {
            title: "Dashboard",
            url: shopBase,
            icon: <TerminalSquareIcon />,
            isActive: true,
        },
        {
            title: "Inventory",
            url: shopBase,
            icon: <BotIcon />,
            items: [
                { title: "Products", url: shopBase },
                { title: "Stock Management", url: shopBase },
            ],
        },
        {
            title: "Team",
            url: `${shopBase}/roles`,
            icon: <UsersIcon />,
            items: [
                { title: "Roles", url: `${shopBase}/roles` },
                { title: "Invites", url: `${shopBase}/invites` },
                { title: "Managers", url: `${shopBase}/managers` },
            ],
        },
    ];

    const pendingCount = myInvites?.length ?? 0;

    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <ShopSwitcher shops={shops} />
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={navMain} />
            </SidebarContent>
            <SidebarFooter>
                {/* Personal inbox: visible to everyone, shop-independent. */}
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            tooltip="My Invites"
                            render={<Link to="/shops/invites" />}
                        >
                            <BellIcon />
                            <span>My Invites</span>
                            {pendingCount > 0 && (
                                <Badge variant="default" className="ml-auto">
                                    {pendingCount}
                                </Badge>
                            )}
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
                <NavUser user={user} />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
