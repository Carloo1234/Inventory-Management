import { AppError } from "./AppError";

/**
 * Rank gate: a non-owner may only mutate roles strictly below them.
 * Target set must be a strict subset of caller set (contained + at least
 * one fewer) — peers (equal sets) and seniors are untouchable. This one
 * rule kills demotion attacks AND self-lockout (your own role's set always
 * equals your own, so self-edits can never pass). Owner bypasses.
 */
export function assertStrictlyJunior({
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
    const target = targetPermissions ?? [];
    const allContained = target.every((p) => held.has(p));
    const strictlyFewer = target.length < held.size;
    if (!allContained || !strictlyFewer) {
        throw new AppError("You can only manage roles below your own level", 403);
    }
}

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
