import { PERMISSIONS } from "../../utils/permissions";
import type { RolesRepository } from "./roles.repository";

export class RolesServices {
    private repository: RolesRepository;
    constructor(repository: RolesRepository) {
        this.repository = repository;
    }

    getPermissions = () => {
        return PERMISSIONS;
    };
}
