import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { CLIENT_NAVIGATION } from "@/config/navigation";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <AppShell title="Lumos" navigation={CLIENT_NAVIGATION}>
      {children}
    </AppShell>
  );
}
