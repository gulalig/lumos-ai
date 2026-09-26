"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, TextField, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { AuthFormCard } from "@/components/forms/AuthFormCard";
import { FormStack } from "@/components/forms/FormStack";
import { AppLink } from "@/components/navigation/AppLink";
import { ROUTES } from "@/constants/routes";
import {
  signupSchema,
  type SignupFormValues,
} from "@/features/auth/auth.schemas";
import { useSignupMutation } from "@/store/api/auth.api";

export function SignupForm() {
  const router = useRouter();

  const [signup, { isLoading, error }] = useSignupMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),

    defaultValues: {
      displayName: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: SignupFormValues) => {
    const result = await signup(values).unwrap();

    const params = new URLSearchParams({
      email: result.email,
    });

    router.push(`${ROUTES.auth.verifyEmail}?${params.toString()}`);
  };

  return (
    <AuthFormCard
      title="Create your account"
      description="Start turning meetings into accountable execution."
      footer={
        <Typography variant="body2">
          Already have an account?{" "}
          <AppLink href={ROUTES.auth.login}>Sign in</AppLink>
        </Typography>
      }
    >
      <FormStack onSubmit={handleSubmit(onSubmit)}>
        {error ? (
          <Alert severity="error">Unable to create your account.</Alert>
        ) : null}

        <TextField
          label="Name"
          autoComplete="name"
          error={Boolean(errors.displayName)}
          helperText={errors.displayName?.message}
          {...register("displayName")}
        />

        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          error={Boolean(errors.email)}
          helperText={errors.email?.message}
          {...register("email")}
        />

        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          error={Boolean(errors.password)}
          helperText={errors.password?.message}
          {...register("password")}
        />

        <Button type="submit" variant="contained" disabled={isLoading}>
          {isLoading ? "Creating account..." : "Create account"}
        </Button>
      </FormStack>
    </AuthFormCard>
  );
}
