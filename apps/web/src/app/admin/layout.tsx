"use client";

import type { ReactNode } from "react";

import { usePathname } from "next/navigation";

import { AdminShell } from "@/components/layout/AdminShell";
import { ADMIN_NAVIGATION } from "@/config/navigation";
import { ROUTES } from "@/constants/routes";
import { AdminAuthGate } from "@/features/admin-auth/AdminAuthGate";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();

  if (pathname === ROUTES.admin.login) {
    return <>{children}</>;
  }

  return (
    <AdminAuthGate>
      <AdminShell navigation={ADMIN_NAVIGATION}>{children}</AdminShell>
    </AdminAuthGate>
  );
}
