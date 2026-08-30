import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { handleServerFormErrors } from "@/lib/form-utils";
import { createResponseSchema, validateDataWithSchema } from "@/lib/response";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, redirect, useNavigate } from "@tanstack/react-router";
import axios from "axios";
import { useForm, type SubmitHandler } from "react-hook-form";
import z from "zod";
import { Spinner } from "./ui/spinner";

export const signupSchema = z
    .object({
        name: z
            .string("Name is required")
            .max(255, "Must be less than 256 characters long")
            .min(2, "Must be at least 2 characters long"),
        email: z.email("Must be in the format example@mail.com").max(255, "Must be less than 256 characters long"),
        password: z
            .string("Password is required")
            .min(8, "Password must be at least 8 characters long")
            .regex(/[A-Za-z]/, "Password must contain at least one letter")
            .regex(/[0-9]/, "Password must contain at least one number")
            .max(255, "Password must be less than 255 characters."),
        confirm: z.string({ error: "Password is required" }),
    })
    .refine((data) => data.password === data.confirm, { error: "Passwords don't match", path: ["confirm"] })
    .strict();

type FormFields = z.infer<typeof signupSchema>;

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
    const navigate = useNavigate();
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<FormFields>({ resolver: zodResolver(signupSchema) });

    const onSubmit: SubmitHandler<FormFields> = async (data) => {
        console.log(`email: ${data.email}, password: ${data.password}`);
        console.log("I ran");
        try {
            const response = await api.post("/auth/signup", data);
            const responseData = validateDataWithSchema(response.data, createResponseSchema());
            console.log(responseData);
            navigate({ to: "/" });
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const responseData = validateDataWithSchema(error.response?.data, createResponseSchema());
                handleServerFormErrors(setError, responseData?.formErrors, ["name", "email", "password", "confirm"]);
                console.log(responseData);
                console.log(`Status: ${error.status}`);
            } else {
                console.log(error);
            }
        }
    };

    return (
        <Card {...props}>
            <CardHeader>
                <CardTitle>Create an account</CardTitle>
                <CardDescription>Enter your information below to create your account</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} noValidate>
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="name">Full Name</FieldLabel>
                            <Input {...register("name")} id="name" type="text" placeholder="John Doe" />
                            {errors.name && <span className="text-destructive">{errors.name.message}</span>}
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="email">Email</FieldLabel>
                            <Input {...register("email")} id="email" type="email" placeholder="m@example.com" />
                            {errors.email && <span className="text-destructive">{errors.email.message}</span>}
                            {/* <FieldDescription>
                                We&apos;ll use this to contact you. We will not share your email with anyone else.
                            </FieldDescription> */}
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="password">Password</FieldLabel>
                            <Input {...register("password")} id="password" type="password" />
                            {errors.password && <span className="text-destructive">{errors.password.message}</span>}
                            {/* <FieldDescription>Must be at least 8 characters long.</FieldDescription> */}
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
                            <Input {...register("confirm")} id="confirm-password" type="password" />
                            {errors.confirm && <span className="text-destructive">{errors.confirm.message}</span>}
                            {/* <FieldDescription>Please confirm your password.</FieldDescription> */}
                        </Field>
                        <FieldGroup>
                            <Field>
                                <Button type="submit">
                                    {isSubmitting ? (
                                        <>
                                            <Spinner data-icon="inline-start"></Spinner>
                                            Loading...
                                        </>
                                    ) : (
                                        "Create Account"
                                    )}
                                </Button>
                                {/* <Button variant="outline" type="button">
                                    Sign up with Google
                                </Button> */}
                                <FieldDescription className="px-6 text-center">
                                    Already have an account? <Link to="/signin">Sign in</Link>
                                </FieldDescription>
                            </Field>
                        </FieldGroup>
                    </FieldGroup>
                </form>
            </CardContent>
        </Card>
    );
}
