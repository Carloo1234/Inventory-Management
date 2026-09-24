import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { shopsQueryOptions } from "@/lib/queries";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import axios from "axios";

/**
 * Shops layout route wrapper providing sidebar, header with theme toggle, and Outlet for nested shop pages.
 */
export const Route = createFileRoute("/shops")({
    loader: async ({ context: { queryClient } }) => {
        try {
            return await queryClient.query(shopsQueryOptions);
        } catch (error) {
            console.log(error);
            if (axios.isAxiosError(error)) {
                if (error.status === 401) {
                    throw redirect({ to: "/signin" });
                }
                throw Error("Couldn't load shops");
            }
            throw error;
        }
    },
    component: ShopsLayoutComponent,
});

function ShopsLayoutComponent() {
    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                {/* Header containing sidebar trigger, separator, dynamic breadcrumbs, and theme toggle */}
                <header className="flex h-16 shrink-0 items-center justify-between px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                    <div className="flex items-center gap-2">
                        <SidebarTrigger className="-ml-1" />
                        {/* <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem className="hidden md:block">
                                    <BreadcrumbLink render={<Link to="/shops" />}>Shops</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block" />
                                <BreadcrumbItem>
                                    <BreadcrumbPage>Dashboard</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb> */}
                    </div>
                    <ThemeToggle />
                </header>
                {/* Render nested child routes (e.g. shop details or index) */}
                <Outlet />
            </SidebarInset>
        </SidebarProvider>
    );
}
