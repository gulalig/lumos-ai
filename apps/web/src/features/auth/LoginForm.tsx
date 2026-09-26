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
  loginSchema,
  type LoginFormValues,
} from "@/features/auth/auth.schemas";
import { useLoginMutation } from "@/store/api/auth.api";

export function LoginForm() {
  const router = useRouter();

  const [login, { isLoading, error }] = useLoginMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),

    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    const result = await login(values).unwrap();

    router.replace(
      result.workspace ? ROUTES.app.dashboard : ROUTES.onboarding.workspace,
    );
  };

  return (
    <AuthFormCard
      title="Welcome back"
      description="Sign in to your Lumos workspace."
      footer={
        <Typography variant="body2">
          Don&apos;t have an account?{" "}
          <AppLink href={ROUTES.auth.signup}>Create account</AppLink>
        </Typography>
      }
    >
      <FormStack onSubmit={handleSubmit(onSubmit)}>
        {error ? (
          <Alert severity="error">
            Unable to sign in. Check your credentials and try again.
          </Alert>
        ) : null}

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
          autoComplete="current-password"
          error={Boolean(errors.password)}
          helperText={errors.password?.message}
          {...register("password")}
        />

        <AppLink href={ROUTES.auth.forgotPassword}>Forgot password?</AppLink>

        <Button type="submit" variant="contained" disabled={isLoading}>
          {isLoading ? "Signing in..." : "Sign in"}
        </Button>
      </FormStack>
    </AuthFormCard>
  );
}
