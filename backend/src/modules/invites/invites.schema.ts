import z from "zod";

// TODO: fill in fields (e.g. invitedUserEmail, roleId, expiresAt).
// Keep .strict() so unknown keys are rejected by validateRequest.
export const createInviteSchema = z
    .object({
        email: z.email("invitedUserEmail"),
        roleId: z.string("roleId"),
    })
    .strict();
