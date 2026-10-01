import type z from "zod";
import type { AttributesRepository } from "./attributes.repository";
import type { createAttributeNameSchema, updateAttributeNameSchema, updateAttributeValueSchema } from "./attributes.schema";
import { AppError } from "../../utils/AppError";

export class AttributesServices {
    private repository: AttributesRepository;
    constructor(repository: AttributesRepository) {
        this.repository = repository;
    }

    createAttributeName = async ({
        data,
        shopId,
    }: {
        data: z.infer<typeof createAttributeNameSchema>;
        shopId: string;
    }) => {
        return this.repository.createAttributeName({ name: data.name, shopId });
    };

    getAttributeNames = async ({ shopId }: { shopId: string }) => {
        return this.repository.getAttributeNames({ shopId });
    };

    getAttributeNameById = async ({ attributeNameId, shopId }: { attributeNameId: string; shopId: string }) => {
        return this.repository.getAttributeNameById({ attributeNameId, shopId });
    };

    updateAttributeNameById = async ({
        data,
        attributeNameId,
        shopId,
    }: {
        data: z.infer<typeof updateAttributeNameSchema>;
        attributeNameId: string;
        shopId: string;
    }) => {
        // Empty PATCH body would be a silent no-op — reject it loudly instead.
        if (data.name === undefined) throw new AppError("Nothing to update", 400);
        return this.repository.updateAttributeNameById({ attributeNameId, shopId, data });
    };

    deleteAttributeNameById = async ({
        attributeNameId,
        shopId,
    }: {
        attributeNameId: string;
        shopId: string;
    }) => {
        return this.repository.deleteAttributeNameById({ attributeNameId, shopId });
    };

    createAttributeValue = async ({
        attributeNameId,
        shopId,
        value,
    }: {
        attributeNameId: string;
        shopId: string;
        value: string;
    }) => {
        return this.repository.createAttributeValue({ attributeNameId, shopId, value });
    };

    getAttributeValues = async ({ attributeNameId, shopId }: { attributeNameId: string; shopId: string }) => {
        return this.repository.getAttributeValues({ attributeNameId, shopId });
    };

    getAttributeValueById = async ({
        attributeNameId,
        attributeValueId,
        shopId,
    }: {
        attributeNameId: string;
        attributeValueId: string;
        shopId: string;
    }) => {
        // URL consistency: the value must hang under the name in the path,
        // not merely under the same shop. Otherwise /names/A/values/B leaks
        // B's existence whenever B belongs to sibling name C.
        const value = await this.repository.getAttributeValueById({ attributeValueId, shopId });
        if (value.attributeNameId !== attributeNameId) throw new AppError("Attribute value not found", 404);
        return value;
    };

    updateAttributeValueById = async ({
        data,
        attributeNameId,
        attributeValueId,
        shopId,
    }: {
        data: z.infer<typeof updateAttributeValueSchema>;
        attributeNameId: string;
        attributeValueId: string;
        shopId: string;
    }) => {
        if (data.value === undefined) throw new AppError("Nothing to update", 400);
        // Same URL-consistency guard as the read path.
        await this.getAttributeValueById({ attributeNameId, attributeValueId, shopId });
        return this.repository.updateAttributeValueById({ attributeValueId, shopId, data });
    };

    deleteAttributeValueById = async ({
        attributeNameId,
        attributeValueId,
        shopId,
    }: {
        attributeNameId: string;
        attributeValueId: string;
        shopId: string;
    }) => {
        // Same URL-consistency guard as the read path.
        await this.getAttributeValueById({ attributeNameId, attributeValueId, shopId });
        return this.repository.deleteAttributeValueById({ attributeValueId, shopId });
    };
}
