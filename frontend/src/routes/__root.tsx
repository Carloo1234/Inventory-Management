import ReactQueryProvider from "@/components/provider/ReactQueryProvider";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

const RootLayout = () => (
    <ReactQueryProvider>
        <div className="flex flex-col min-h-dvh">
            <div className="sticky top-0 z-50 bg-background">
                <div className="p-2 flex gap-2">
                    <Link to="/" className="[&.active]:font-bold">
                        Home
                    </Link>{" "}
                    <Link to="/signin" className="[&.active]:font-bold">
                        Sign in
                    </Link>
                    <Link to="/signup" className="[&.active]:font-bold">
                        Sign up
                    </Link>
                </div>
                <hr />
            </div>
            <Outlet />
        </div>
        <TanStackRouterDevtools />
    </ReactQueryProvider>
);

export const Route = createRootRoute({ component: RootLayout });
