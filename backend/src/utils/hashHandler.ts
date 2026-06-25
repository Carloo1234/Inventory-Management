import argon2 from "argon2";
import { AppError } from "../utils/AppError";

export class HashHandler {
    async hashPassword(password: string) {
        try {
            return await argon2.hash(password, {
                type: argon2.argon2id,
                memoryCost: 2 ** 16, // 64 M(OWASP recommended baseline)
                timeCost: 3, // 3 iterations
                parallelism: 4, // 4 parallel threads
            });
        } catch (error) {
            if (error instanceof Error) {
                throw new AppError(`Hashing Error | ${error.message}`, 500);
            }
            throw new AppError("Internal Error Occured With Hashing", 500);
        }
    }
}
