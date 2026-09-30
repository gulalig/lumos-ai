"use client";

import { Box, Grid, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import type { ReactNode } from "react";

import { LumosLogo } from "@/components/brand/LumosLogo";

const TOTAL_STEPS = 3;

const OnboardingRoot = styled(Grid)(({ theme }) => ({
  minHeight: "100vh",
  backgroundColor: theme.palette.background.default,
}));

const FormPanel = styled(Grid)(({ theme }) => ({
  minHeight: "100vh",
  padding: theme.spacing(3),

  [theme.breakpoints.up("sm")]: {
    padding: theme.spacing(4),
  },

  [theme.breakpoints.up("lg")]: {
    padding: theme.spacing(5),
  },
}));

const FormPanelContent = styled(Box)({
  display: "grid",
  gridTemplateRows: "auto 1fr",
  width: "100%",
  minHeight: "100%",
});

const LogoContainer = styled(Box)({
  display: "flex",
  justifyContent: "flex-start",
  alignItems: "flex-start",
});

const FormArea = styled(Box)(({ theme }) => ({
  display: "flex",
  width: "100%",
  alignItems: "center",
  justifyContent: "center",
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(4),
}));

const FormContainer = styled(Box)({
  width: "100%",
  maxWidth: 440,
});

const Progress = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(1),
  marginBottom: theme.spacing(4),
}));

const ProgressText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontWeight: theme.typography.fontWeightMedium,
}));

const ProgressTrack = styled(Box)(({ theme }) => ({
  height: 4,
  overflow: "hidden",
  borderRadius: 999,
  backgroundColor: theme.palette.action.selected,
}));

interface ProgressValueProps {
  progress: number;
}

const ProgressValue = styled(Box, {
  shouldForwardProp: (prop) => prop !== "progress",
})<ProgressValueProps>(({ theme, progress }) => ({
  width: `${progress}%`,
  height: "100%",
  borderRadius: 999,
  backgroundColor: theme.palette.primary.main,
  transition: "width 180ms ease",
}));

const BrandPanel = styled(Grid)(({ theme }) => ({
  display: "none",
  padding: theme.spacing(6),
  backgroundColor: theme.palette.background.paper,

  [theme.breakpoints.up("md")]: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
}));

const BrandMessage = styled(Box)(({ theme }) => ({
  display: "grid",
  width: "100%",
  maxWidth: 520,
  gap: theme.spacing(2),
}));

interface OnboardingShellProps {
  children: ReactNode;
  currentStep?: number;
}

export function OnboardingShell({
  children,
  currentStep = 1,
}: OnboardingShellProps) {
  const safeStep = Math.min(Math.max(currentStep, 1), TOTAL_STEPS);

  const progress = (safeStep / TOTAL_STEPS) * 100;

  return (
    <OnboardingRoot container>
      <FormPanel size={{ xs: 12, md: 6 }}>
        <FormPanelContent>
          <LogoContainer>
            <LumosLogo />
          </LogoContainer>

          <FormArea>
            <FormContainer>
              <Progress>
                <ProgressText variant="body2">
                  Step {safeStep} of {TOTAL_STEPS}
                </ProgressText>

                <ProgressTrack>
                  <ProgressValue progress={progress} />
                </ProgressTrack>
              </Progress>

              {children}
            </FormContainer>
          </FormArea>
        </FormPanelContent>
      </FormPanel>

      <BrandPanel size={{ xs: 0, md: 6 }}>
        <BrandMessage></BrandMessage>
      </BrandPanel>
    </OnboardingRoot>
  );
}
