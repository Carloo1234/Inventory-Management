import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Toaster } from "sonner";

const RootLayout = () => (
    <ThemeProvider defaultTheme="system">
        <TooltipProvider>
            <div className="flex flex-col min-h-dvh">
                <Outlet />
            </div>
            <Toaster richColors position="bottom-center" />
            <TanStackRouterDevtools />
        </TooltipProvider>
    </ThemeProvider>
);
interface MyRouterContext {
    queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({ component: RootLayout });
