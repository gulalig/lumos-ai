import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { ADMIN_NAVIGATION } from "@/config/navigation";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <AppShell title="Lumos Admin" navigation={ADMIN_NAVIGATION}>
      {children}
    </AppShell>
  );
}
