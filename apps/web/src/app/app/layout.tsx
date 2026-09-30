"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { CLIENT_NAVIGATION } from "@/config/navigation";
import { ROUTES } from "@/constants/routes";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();

  const isDemoRoute = pathname === ROUTES.app.demo;

  if (isDemoRoute) {
    return children;
  }

  return (
    <AppShell title="Lumos" navigation={CLIENT_NAVIGATION}>
      {children}
    </AppShell>
  );
}
