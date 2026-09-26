"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, TextField } from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";

import { AuthFormCard } from "@/components/forms/AuthFormCard";
import { FormStack } from "@/components/forms/FormStack";
import { ROUTES } from "@/constants/routes";
import {
  verifyEmailSchema,
  type VerifyEmailFormValues,
} from "@/features/auth/auth.schemas";
import {
  useResendEmailVerificationMutation,
  useVerifyEmailMutation,
} from "@/store/api/auth.api";

export function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const email = searchParams.get("email") ?? "";

  const [verifyEmail, { isLoading, error }] = useVerifyEmailMutation();

  const [resend, { isLoading: isResending }] =
    useResendEmailVerificationMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyEmailFormValues>({
    resolver: zodResolver(verifyEmailSchema),

    defaultValues: {
      email,
      code: "",
    },
  });

  const onSubmit = async (values: VerifyEmailFormValues) => {
    await verifyEmail(values).unwrap();

    router.replace(ROUTES.auth.login);
  };

  const handleResend = async () => {
    if (!email) {
      return;
    }

    await resend({
      email,
    }).unwrap();
  };

  return (
    <AuthFormCard
      title="Verify your email"
      description={
        email
          ? `Enter the verification code sent to ${email}.`
          : "Enter your email and verification code."
      }
    >
      <FormStack onSubmit={handleSubmit(onSubmit)}>
        {error ? (
          <Alert severity="error">
            The verification code is invalid or expired.
          </Alert>
        ) : null}

        <TextField
          label="Email"
          type="email"
          error={Boolean(errors.email)}
          helperText={errors.email?.message}
          {...register("email")}
        />

        <TextField
          label="Verification code"
          inputMode="numeric"
          error={Boolean(errors.code)}
          helperText={errors.code?.message}
          {...register("code")}
        />

        <Button type="submit" variant="contained" disabled={isLoading}>
          {isLoading ? "Verifying..." : "Verify email"}
        </Button>

        <Button
          type="button"
          variant="text"
          disabled={isResending || !email}
          onClick={() => {
            void handleResend();
          }}
        >
          {isResending ? "Sending..." : "Resend code"}
        </Button>
      </FormStack>
    </AuthFormCard>
  );
}
