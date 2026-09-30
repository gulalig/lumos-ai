"use client";

import { Alert, Button, TextField, Typography } from "@mui/material";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { AuthFormCard } from "@/components/forms/AuthFormCard";
import { FormStack } from "@/components/forms/FormStack";
import { AppLink } from "@/components/navigation/AppLink";
import { ROUTES } from "@/constants/routes";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "@/features/auth/auth.schemas";
import { useForgotPasswordMutation } from "@/store/api/auth.api";

export function ForgotPasswordForm() {
  const router = useRouter();

  const [forgotPassword, { isLoading, error }] = useForgotPasswordMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),

    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    try {
      await forgotPassword({
        email: values.email,
      }).unwrap();

      const params = new URLSearchParams({
        email: values.email,
      });

      router.push(`${ROUTES.auth.resetPassword}?${params.toString()}`);
    } catch {
      // RTK Query exposes the request error through mutation state.
    }
  };

  return (
    <AuthFormCard
      title="Reset your password"
      description="Enter your email and we’ll send you a verification code."
      footer={
        <Typography variant="body2">
          Remember your password?{" "}
          <AppLink href={ROUTES.auth.login}>Back to sign in</AppLink>
        </Typography>
      }
    >
      <FormStack onSubmit={handleSubmit(onSubmit)}>
        {error ? (
          <Alert severity="error">Unable to send the reset code.</Alert>
        ) : null}

        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          error={Boolean(errors.email)}
          helperText={errors.email?.message}
          {...register("email")}
        />

        <Button type="submit" variant="contained" disabled={isLoading}>
          {isLoading ? "Sending code..." : "Send reset code"}
        </Button>
      </FormStack>
    </AuthFormCard>
  );
}
