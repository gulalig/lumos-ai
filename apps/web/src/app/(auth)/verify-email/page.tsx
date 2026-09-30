import { Suspense } from "react";

import { VerifyEmailForm } from "@/features/auth/VerifyEmailForm";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Verify email" };
