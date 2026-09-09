import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Root index route ("/") redirects authenticated users to the shops section.
 */
export const Route = createFileRoute("/")({
    loader: async () => {
        throw redirect({ to: "/shops" });
    },
    component: Index,
});

function Index() {
    return null;
}
