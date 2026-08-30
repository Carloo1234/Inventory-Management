import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import axios from "axios";
import z from "zod";

const userSchema = z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string(),
    shopLimit: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

type User = z.infer<typeof userSchema>;

// Throws error if user isn't fetched properly or if there was any issue
async function fetchUser(): Promise<User> {
    const response = await api.get("/auth/me");
    const user = response.data.data.user;
    console.log(user);
    return userSchema.parse(user);
}
const userQueryOptions = queryOptions({ queryKey: ["user", "me"], queryFn: fetchUser });

export const Route = createFileRoute("/")({
    loader: async ({ context: { queryClient } }) => {
        try {
            return await queryClient.query(userQueryOptions);
        } catch (error) {
            if (axios.isAxiosError(error) && error.status === 401) {
                throw redirect({ to: "/signin" });
            }
            // If it's some other error (like 500), let it crash to your ErrorBoundary
            throw error;
        }
    },
    component: Index,
});
function Index() {
    const { data: userData } = useQuery(userQueryOptions);

    return <div>{JSON.stringify(userData)}</div>;
}
