"use client";

import { VisibilityOffOutlined, VisibilityOutlined } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  FormHelperText,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
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

const CheckboxGroup = styled(Box)(({ theme }) => ({
  display: "grid",

  gap: theme.spacing(0.05),

  "& .MuiFormControlLabel-root": {
    margin: 0,
  },
}));

export function SignupForm() {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);

  const [signup, { isLoading, error }] = useSignupMutation();

  const {
    register,
    handleSubmit,

    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),

    defaultValues: {
      email: "",

      password: "",

      acceptedTerms: false,

      newsletterOptIn: false,
    },
  });

  const onSubmit = async (values: SignupFormValues) => {
    try {
      const result = await signup({
        email: values.email,

        password: values.password,

        acceptedTerms: values.acceptedTerms,

        newsletterOptIn: values.newsletterOptIn,
      }).unwrap();

      const params = new URLSearchParams({
        email: result.email,
      });

      router.push(`${ROUTES.auth.verifyEmail}?${params.toString()}`);
    } catch {
      // RTK Query exposes the request error through mutation state.
    }
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
          label="Email"
          type="email"
          autoComplete="email"
          error={Boolean(errors.email)}
          helperText={errors.email?.message}
          {...register("email")}
        />

        <TextField
          label="Password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          error={Boolean(errors.password)}
          helperText={errors.password?.message}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    type="button"
                    edge="end"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
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
          {...register("password")}
        />

        <CheckboxGroup>
          <Box>
            <FormControlLabel
              control={<Checkbox {...register("acceptedTerms")} />}
              label={
                <Typography variant="body2">
                  I agree to the{" "}
                  <AppLink href="/terms">Terms of Service</AppLink>
                  {" and "}
                  <AppLink href="/privacy">Privacy Policy</AppLink>
                </Typography>
              }
            />

            {errors.acceptedTerms ? (
              <FormHelperText error>
                {errors.acceptedTerms.message}
              </FormHelperText>
            ) : null}
          </Box>

          <FormControlLabel
            control={<Checkbox {...register("newsletterOptIn")} />}
            label={
              <Typography variant="body2">
                Send me product updates, tips and occasional Lumos news
              </Typography>
            }
          />
        </CheckboxGroup>

        <Button type="submit" variant="contained" disabled={isLoading}>
          {isLoading ? "Creating account..." : "Create account"}
        </Button>
      </FormStack>
    </AuthFormCard>
  );
}
