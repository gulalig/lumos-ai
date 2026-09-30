import { ForgotPasswordForm } from "@/features/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Forgot password" };
