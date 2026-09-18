/**
 * Extracts the PostgreSQL error code (e.g. '23505' unique violation,
 * '23503' foreign key violation) from a Drizzle query failure.
 *
 * Drizzle wraps the raw driver error in a DrizzleQueryError, so the PG
 * `code` lives on `error.cause` — never on the error itself. Checking only
 * `error.code` silently misses every constraint mapping and falls through
 * to generic 500s.
 */
export function getPgErrorCode(error: unknown): string | undefined {
    if (typeof error !== "object" || error === null) return undefined;
    const direct = (error as { code?: unknown }).code;
    if (typeof direct === "string") return direct;
    const cause = (error as { cause?: unknown }).cause;
    if (typeof cause === "object" && cause !== null) {
        const nested = (cause as { code?: unknown }).code;
        if (typeof nested === "string") return nested;
    }
    return undefined;
}
