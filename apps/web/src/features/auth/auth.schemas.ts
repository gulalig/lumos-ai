import { z } from "zod";

export const signupSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Name is required")
    .max(100, "Name is too long"),

  email: z.string().trim().email("Enter a valid email address"),

  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),

  password: z.string().min(1, "Password is required"),
});

export const verifyEmailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),

  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

export const resetPasswordSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email address"),

    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Enter the 6-digit code"),

    newPassword: z.string().min(8, "Password must be at least 8 characters"),

    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignupFormValues = z.infer<typeof signupSchema>;

export type LoginFormValues = z.infer<typeof loginSchema>;

export type VerifyEmailFormValues = z.infer<typeof verifyEmailSchema>;

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
