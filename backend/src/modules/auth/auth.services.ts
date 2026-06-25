import { AuthRepository } from "./auth.repository";
import { AppError, FormError } from "../../utils/AppError";
import { HashHandler } from "../../utils/hashHandler";

export class AuthServices {
    private repository: AuthRepository;
    private hashHandler: HashHandler;
    constructor(repository: AuthRepository, hashHandler: HashHandler) {
        this.repository = repository;
        this.hashHandler = hashHandler;
    }
    signup = async (name: string, email: string, password: string) => {
        const userExists: boolean = await this.repository.doesUserExist(email);
        if (userExists) {
            throw new FormError("Account with this email already exists", 409, {
                formErrors: [],
                fieldErrors: { email: ["Account with this email already exists"] },
            });
        }
        const hashPassword = await this.hashHandler.hashPassword(password);
        const user = await this.repository.createUser(name, email, hashPassword);
        return user;
    };
}
