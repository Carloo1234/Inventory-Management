import * as React from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ShopAttribute } from "@/lib/queries";
import { PlusIcon, XIcon } from "lucide-react";

interface AttributeValuePickerProps {
    attributes: ShopAttribute[] | undefined;
    /** Currently selected value IDs (across all attributes). */
    selectedIds: string[];
    onChange: (nextIds: string[]) => void;
}

/**
 * Attribute rows for a variant form. Starts empty: "Add attribute" offers a
 * dropdown of not-yet-attached attributes, picking one opens its value
 * dropdown, and each attached row can change value or be removed entirely.
 * Convention: at most one value per attribute per variant.
 */
export function AttributeValuePicker({ attributes, selectedIds, onChange }: AttributeValuePickerProps) {
    const [pendingAttrId, setPendingAttrId] = React.useState<string | null>(null);

    const attached = (attributes ?? []).filter((attribute) =>
        selectedIds.some((id) => attribute.values.some((v) => v.id === id)),
    );
    const available = (attributes ?? []).filter(
        (attribute) => !selectedIds.some((id) => attribute.values.some((v) => v.id === id)),
    );
    const pendingAttribute = (attributes ?? []).find((a) => a.id === pendingAttrId) ?? null;

    const setValueFor = (attribute: ShopAttribute, valueId: string) => {
        const others = selectedIds.filter((id) => !attribute.values.some((v) => v.id === id));
        onChange(valueId ? [...others, valueId] : others);
    };

    const removeAttribute = (attribute: ShopAttribute) => {
        onChange(selectedIds.filter((id) => !attribute.values.some((v) => v.id === id)));
        if (pendingAttrId === attribute.id) setPendingAttrId(null);
    };

    return (
        <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Attributes</span>

            {attached.map((attribute) => {
                const current = selectedIds.find((id) => attribute.values.some((v) => v.id === id)) ?? "";
                return (
                    <div key={attribute.id} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 truncate text-sm text-muted-foreground">{attribute.name}</span>
                        <Select value={current} onValueChange={(value) => setValueFor(attribute, value ?? "")}>
                            <SelectTrigger className="flex-1 py-2">
                                <SelectValue placeholder={`Choose ${attribute.name.toLowerCase()}`}>
                                    {(val: string | null) =>
                                        attribute.values.find((v) => v.id === val)?.value ?? "Choose value"
                                    }
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="p-1.5">
                                {attribute.values.map((option) => (
                                    <SelectItem key={option.id} value={option.id}>
                                        {option.value}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0"
                            onClick={() => removeAttribute(attribute)}
                            aria-label={`Remove ${attribute.name}`}
                        >
                            <XIcon className="size-4 text-destructive" />
                        </Button>
                    </div>
                );
            })}

            {pendingAttribute && (
                <div className="flex items-center gap-2">
                    <span className="w-24 shrink-0 truncate text-sm text-muted-foreground">
                        {pendingAttribute.name}
                    </span>
                    <Select
                        value=""
                        onValueChange={(value) => {
                            if (value) {
                                setValueFor(pendingAttribute, value);
                                setPendingAttrId(null);
                            }
                        }}
                    >
                        <SelectTrigger className="flex-1 py-2">
                            <SelectValue placeholder={`Choose ${pendingAttribute.name.toLowerCase()}`} />
                        </SelectTrigger>
                        <SelectContent className="p-1.5">
                            {pendingAttribute.values.map((option) => (
                                <SelectItem key={option.id} value={option.id}>
                                    {option.value}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setPendingAttrId(null)}
                        aria-label="Cancel"
                    >
                        <XIcon className="size-4 text-destructive" />
                    </Button>
                </div>
            )}

            {available.length > 0 && pendingAttribute === null && (
                <Field>
                    <FieldLabel>
                        <span className="inline-flex items-center gap-1">
                            <PlusIcon className="size-3" /> Add attribute
                        </span>
                    </FieldLabel>
                    <Select value="" onValueChange={(value) => value && setPendingAttrId(value)}>
                        <SelectTrigger className="w-full py-2">
                            <SelectValue placeholder="Choose an attribute..." />
                        </SelectTrigger>
                        <SelectContent className="p-1.5">
                            {available.map((attribute) => (
                                <SelectItem key={attribute.id} value={attribute.id}>
                                    {attribute.name} · {attribute.values.length} value
                                    {attribute.values.length === 1 ? "" : "s"}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
            )}
        </div>
    );
}
