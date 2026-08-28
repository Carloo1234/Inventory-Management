import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { CleanErrors } from "./response";

export function handleServerFormErrors<TFieldValues extends FieldValues>(
    setError: UseFormSetError<TFieldValues>,
    errors: CleanErrors | null | undefined,
    /** Pass an array of valid form keys, e.g. ["email", "password"] */
    validFields?: (keyof TFieldValues)[],
) {
    if (!errors) return;

    if (errors.fieldErrors) {
        Object.entries(errors.fieldErrors).forEach(([field, messages]) => {
            // Check if the backend field actually exists on the frontend form
            const isKnownField = validFields?.includes(field as keyof TFieldValues);

            // If recognized, map to the field. If unknown, route to "root" so the user can see it!
            const targetPath = isKnownField ? (field as Path<TFieldValues>) : ("root" as Path<TFieldValues>);

            messages.forEach((message) => {
                setError(targetPath, { message });
            });
        });
    }

    if (errors.formErrors) {
        errors.formErrors.forEach((message) => {
            setError("root" as Path<TFieldValues>, { message });
        });
    }
}
