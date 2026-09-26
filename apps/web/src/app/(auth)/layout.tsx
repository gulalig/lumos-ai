import type { ReactNode } from "react";

import { AuthShell } from "@/components/layout/AuthShell";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return <AuthShell>{children}</AuthShell>;
}
