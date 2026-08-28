import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Link } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { createResponseSchema, validateDataWithSchema } from "@/lib/response";
import axios from "axios";
import { useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { handleServerFormErrors } from "@/lib/form-utils";
import { Spinner } from "./ui/spinner";
import { zodResolver } from "@hookform/resolvers/zod";

const userSchema = z.object({
    createdAt: z.string(),
    email: z.string(),
    id: z.string(),
    name: z.string(),
    updatedAt: z.string(),
});

const signinSchema = z.object({
    email: z.email(),
    password: z.string().max(255),
});

type FormFields = z.infer<typeof signinSchema>;

const responseSchema = createResponseSchema(userSchema);

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<FormFields>({ resolver: zodResolver(signinSchema) });

    const onSubmit: SubmitHandler<FormFields> = async (data) => {
        console.log(`email: ${data.email}, password: ${data.password}`);
        console.log("I ran");
        try {
            const response = await api.post("/auth/signin", {
                email: data.email,
                password: data.password,
            });
            const responseData = validateDataWithSchema(response.data, responseSchema);

            console.log(responseData);
            // Redirect to home
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.log(error.response?.data);
                const responseData = validateDataWithSchema(error.response?.data, responseSchema);

                handleServerFormErrors(setError, responseData?.formErrors, ["email", "password"]);
            } else {
                console.log(error);
            }
        }
    };
    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card>
                <CardHeader>
                    <CardTitle>Sign in to your account</CardTitle>
                    <CardDescription>Enter your email below to login to your account</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} noValidate>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="email">Email</FieldLabel>
                                <Input
                                    {...register("email")}
                                    id="email"
                                    type="email"
                                    name="email"
                                    placeholder="m@example.com"
                                    required
                                />
                                {errors.email && <span className="text-destructive">{errors.email.message}</span>}
                            </Field>
                            <Field>
                                <div className="flex items-center">
                                    <FieldLabel htmlFor="password">Password</FieldLabel>
                                    {/* <a
                    href="#"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a> */}
                                </div>
                                <Input
                                    {...register("password")}
                                    id="password"
                                    type="password"
                                    name="password"
                                    required
                                />
                                {errors.password && <span className="text-destructive">{errors.password.message}</span>}
                            </Field>
                            <Field>
                                {errors.root && <span className="text-destructive">{errors.root.message}</span>}
                                <Button disabled={isSubmitting} type="submit">
                                    {isSubmitting ? (
                                        <>
                                            <Spinner data-icon="inline-start"></Spinner>
                                            Loading
                                        </>
                                    ) : (
                                        "Login"
                                    )}
                                </Button>
                                {/* <Button variant="outline" type="button">
                                    Login with Google
                                </Button> */}
                                <FieldDescription className="text-center">
                                    Don&apos;t have an account? <Link to="/signup">Sign up</Link>
                                </FieldDescription>
                            </Field>
                        </FieldGroup>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
