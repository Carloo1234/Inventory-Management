import { AppError } from "./AppError";

/**
 * Anti-escalation gate: a non-owner may only grant permissions they hold.
 *
 * Enforced at role create/update, invite creation, and manager role
 * reassignment. Owners bypass (root of the shop). Throws 403 naming the
 * offending permissions so the caller knows exactly what was rejected.
 */
export function assertGrantable({
    callerIsOwner,
    callerPermissions,
    targetPermissions,
}: {
    callerIsOwner: boolean;
    callerPermissions: string[] | null | undefined;
    targetPermissions: string[] | null | undefined;
}) {
    if (callerIsOwner) return;
    const held = new Set(callerPermissions ?? []);
    const offending = (targetPermissions ?? []).filter((p) => !held.has(p));
    if (offending.length > 0) {
        throw new AppError(`You cannot grant permissions you do not hold: ${offending.join(", ")}`, 403);
    }
}
