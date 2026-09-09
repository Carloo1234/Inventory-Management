import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { ChevronRightIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";

/**
 * NavMain component rendering collapsible sidebar menu groups with client-side routing links.
 */
export function NavMain({
    items,
}: {
    items: {
        title: string;
        url: string;
        icon?: React.ReactNode;
        isActive?: boolean;
        items?: {
            title: string;
            url: string;
        }[];
    }[];
}) {
    return (
        <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => (
                    <Collapsible
                        key={item.title}
                        defaultOpen={item.isActive}
                        className="group/collapsible"
                        render={<SidebarMenuItem />}
                    >
                        {item.items && item.items.length > 0 ? (
                            <CollapsibleTrigger render={<SidebarMenuButton tooltip={item.title} />}>
                                {item.icon}
                                <span>{item.title}</span>
                                <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90" />
                            </CollapsibleTrigger>
                        ) : (
                            <SidebarMenuButton tooltip={item.title} render={<Link to={item.url} />}>
                                {item.icon}
                                <span>{item.title}</span>
                            </SidebarMenuButton>
                        )}
                        {item.items && item.items.length > 0 && (
                            <CollapsibleContent>
                                <SidebarMenuSub>
                                    {item.items.map((subItem) => (
                                        <SidebarMenuSubItem key={subItem.title}>
                                            <SidebarMenuSubButton render={<Link to={subItem.url} />}>
                                                <span>{subItem.title}</span>
                                            </SidebarMenuSubButton>
                                        </SidebarMenuSubItem>
                                    ))}
                                </SidebarMenuSub>
                            </CollapsibleContent>
                        )}
                    </Collapsible>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}
