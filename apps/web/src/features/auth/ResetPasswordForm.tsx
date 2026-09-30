"use client";

import { VisibilityOffOutlined, VisibilityOutlined } from "@mui/icons-material";
import {
  Alert,
  Button,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { AuthFormCard } from "@/components/forms/AuthFormCard";
import { FormStack } from "@/components/forms/FormStack";
import { AppLink } from "@/components/navigation/AppLink";
import { ROUTES } from "@/constants/routes";
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from "@/features/auth/auth.schemas";
import { useResetPasswordMutation } from "@/store/api/auth.api";

interface ResetPasswordFormProps {
  initialEmail?: string;
}

export function ResetPasswordForm({
  initialEmail = "",
}: ResetPasswordFormProps) {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [resetPassword, { isLoading, error }] = useResetPasswordMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),

    defaultValues: {
      email: initialEmail,

      code: "",

      newPassword: "",

      confirmPassword: "",
    },
  });

  const onSubmit = async (values: ResetPasswordFormValues) => {
    try {
      await resetPassword({
        email: values.email,

        code: values.code,

        newPassword: values.newPassword,
      }).unwrap();

      router.push(ROUTES.auth.login);
    } catch {
      // RTK Query exposes the request error through mutation state.
    }
  };

  return (
    <AuthFormCard
      title="Create a new password"
      description="Enter the verification code from your email and choose a new password."
      footer={
        <Typography variant="body2">
          Didn&apos;t request a reset?{" "}
          <AppLink href={ROUTES.auth.login}>Back to sign in</AppLink>
        </Typography>
      }
    >
      <FormStack onSubmit={handleSubmit(onSubmit)}>
        {error ? (
          <Alert severity="error">
            Unable to reset your password. Check the code and try again.
          </Alert>
        ) : null}

        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          error={Boolean(errors.email)}
          helperText={errors.email?.message}
          slotProps={{
            input: {
              readOnly: Boolean(initialEmail),
            },
          }}
          {...register("email")}
        />

        <TextField
          label="Verification code"
          type="text"
          autoComplete="one-time-code"
          error={Boolean(errors.code)}
          helperText={errors.code?.message ?? "Enter the 6-digit code"}
          slotProps={{
            htmlInput: {
              inputMode: "numeric",
              maxLength: 6,
            },
          }}
          {...register("code")}
        />

        <TextField
          label="New password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          error={Boolean(errors.newPassword)}
          helperText={errors.newPassword?.message}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    type="button"
                    edge="end"
                    aria-label={
                      showPassword ? "Hide new password" : "Show new password"
                    }
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? (
                      <VisibilityOffOutlined />
                    ) : (
                      <VisibilityOutlined />
                    )}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
          {...register("newPassword")}
        />

        <TextField
          label="Confirm password"
          type={showConfirmPassword ? "text" : "password"}
          autoComplete="new-password"
          error={Boolean(errors.confirmPassword)}
          helperText={errors.confirmPassword?.message}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    type="button"
                    edge="end"
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirmed password"
                        : "Show confirmed password"
                    }
                    onClick={() =>
                      setShowConfirmPassword((current) => !current)
                    }
                  >
                    {showConfirmPassword ? (
                      <VisibilityOffOutlined />
                    ) : (
                      <VisibilityOutlined />
                    )}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
          {...register("confirmPassword")}
        />

        <Button type="submit" variant="contained" disabled={isLoading}>
          {isLoading ? "Resetting password..." : "Reset password"}
        </Button>
      </FormStack>
    </AuthFormCard>
  );
}
