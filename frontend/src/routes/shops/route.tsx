import { AppSidebar } from "@/components/app-sidebar";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { api } from "@/lib/api";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import axios from "axios";
import z from "zod";

const shopSchema = z.object({
    id: z.string(),
    name: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    ownerId: z.string(),
    softDelete: z.boolean(),
    isOwner: z.boolean(),
    managerPermissions: z.array(z.string()).nullable(),
});

const shopsSchema = z.array(shopSchema);

type Shop = z.infer<typeof shopSchema>;
type Shops = z.infer<typeof shopsSchema>;

async function fetchShops(): Promise<Shops> {
    const response = await api.get("/shops/my-shops");
    if (!response.validResponse) throw Error("Data sent from server is invalid");
    const shops = response.validResponse.data.shops;
    return shopsSchema.parse(shops);
}

export const shopsQueryOptions = queryOptions({ queryKey: ["shops", "me"], queryFn: fetchShops });

export const Route = createFileRoute("/shops")({
    loader: async ({ context: { queryClient } }) => {
        try {
            return await queryClient.query(shopsQueryOptions);
        } catch (error) {
            console.log(error);
            if (axios.isAxiosError(error)) {
                throw Error("Couldn't load shops");
            }
            throw error;
        }
    },
    component: RouteComponent,
});

function RouteComponent() {
    const { data: shops } = useQuery(shopsQueryOptions);

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                    <div className="flex items-center gap-2 px-4">
                        <SidebarTrigger className="-ml-1" />
                        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem className="hidden md:block">
                                    <BreadcrumbLink href="#">Build Your Application</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block" />
                                <BreadcrumbItem>
                                    <BreadcrumbPage>Data Fetching</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                </header>
                <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                    <div className="grid auto-rows-min gap-4 md:grid-cols-3">
                        <div className="aspect-video rounded-xl bg-muted/50" />
                        <div className="aspect-video rounded-xl bg-muted/50" />
                        <div className="aspect-video rounded-xl bg-muted/50" />
                    </div>
                    <div className="min-h-screen flex-1 rounded-xl bg-muted/50 md:min-h-min" />
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
