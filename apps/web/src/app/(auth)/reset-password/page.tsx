import { ResetPasswordForm } from "@/features/auth/ResetPasswordForm";

interface ResetPasswordPageProps {
  searchParams: Promise<{
    email?: string;
  }>;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const params = await searchParams;

  return <ResetPasswordForm initialEmail={params.email ?? ""} />;
}
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reset password" };
