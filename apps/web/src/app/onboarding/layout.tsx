import type { ReactNode } from "react";

interface OnboardingLayoutProps {
  children: ReactNode;
}

export default function OnboardingLayout({ children }: OnboardingLayoutProps) {
  return children;
}
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Onboarding" };
