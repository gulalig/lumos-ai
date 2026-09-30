"use client";

import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";

import { HeroSection } from "@/components/landing/hero/HeroSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { IntegrationsSection } from "@/components/landing/IntegrationsSection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";

const LandingRoot = styled(Box)(({ theme }) => ({
  minHeight: "100vh",

  backgroundColor: theme.palette.background.paper,
}));

export function LandingPage() {
  return (
    <LandingRoot>
      <LandingHeader />

      <HeroSection />

      <HowItWorksSection />

      <IntegrationsSection />

      <LandingFooter />
    </LandingRoot>
  );
}
