"use client";

import * as React from "react";
import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { NavUser } from "@/components/nav-user";
import { ShopSwitcher } from "@/components/shop-switcher";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from "@/components/ui/sidebar";
import {
    TerminalSquareIcon,
    BotIcon,
    BookOpenIcon,
    Settings2Icon,
    FrameIcon,
    PieChartIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { shopsQueryOptions, userQueryOptions } from "@/lib/queries";
import { useParams } from "@tanstack/react-router";

/**
 * AppSidebar component housing shop switcher, main navigation, projects/shortcuts, and user footer.
 */
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const { data: shops } = useQuery(shopsQueryOptions);
    const { data: user } = useQuery(userQueryOptions);
    const params = useParams({ strict: false }) as { shopId?: string };
    const currentShopId = params.shopId || (shops && shops[0]?.id);

    // Build dynamic main navigation items using the active shop ID
    const navMain = [
        {
            title: "Dashboard",
            url: currentShopId ? `/shops/${currentShopId}` : "/shops",
            icon: <TerminalSquareIcon />,
            isActive: true,
        },
        {
            title: "Inventory",
            url: currentShopId ? `/shops/${currentShopId}` : "/shops",
            icon: <BotIcon />,
            items: [
                { title: "Products", url: currentShopId ? `/shops/${currentShopId}` : "/shops" },
                { title: "Stock Management", url: currentShopId ? `/shops/${currentShopId}` : "/shops" },
            ],
        },
        {
            title: "Sales & Orders",
            url: currentShopId ? `/shops/${currentShopId}` : "/shops",
            icon: <BookOpenIcon />,
            items: [
                { title: "Transactions", url: currentShopId ? `/shops/${currentShopId}` : "/shops" },
                { title: "Reports", url: currentShopId ? `/shops/${currentShopId}` : "/shops" },
            ],
        },
        {
            title: "Settings",
            url: currentShopId ? `/shops/${currentShopId}` : "/shops",
            icon: <Settings2Icon />,
            items: [
                { title: "General", url: currentShopId ? `/shops/${currentShopId}` : "/shops" },
                { title: "Team & Roles", url: currentShopId ? `/shops/${currentShopId}` : "/shops" },
            ],
        },
    ];

    const projects = [
        {
            name: "POS Terminal",
            url: currentShopId ? `/shops/${currentShopId}` : "/shops",
            icon: <FrameIcon />,
        },
        {
            name: "Analytics",
            url: currentShopId ? `/shops/${currentShopId}` : "/shops",
            icon: <PieChartIcon />,
        },
    ];

    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <ShopSwitcher shops={shops} />
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={navMain} />
                <NavProjects projects={projects} />
            </SidebarContent>
            <SidebarFooter>
                <NavUser user={user} />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
