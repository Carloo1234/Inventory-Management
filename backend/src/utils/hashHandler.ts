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
            throw new AppError("Internal error with hashing", 500);
        }
    }

    async verifyPassword(password: string, hashedPassword: string) {
        try {
            const isCorrectPassword = await argon2.verify(hashedPassword, password);
            if (isCorrectPassword) {
                return true;
            }
            return false;
        } catch (error) {
            throw new AppError("Internal error with hashing", 500);
        }
    }
}
