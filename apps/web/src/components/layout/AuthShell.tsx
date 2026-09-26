"use client";

import { Box, Grid, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import type { ReactNode } from "react";

import { LumosLogo } from "@/components/brand/LumosLogo";

const AuthRoot = styled(Grid)(({ theme }) => ({
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
  height: "100%",
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

const BrandHeadline = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
  letterSpacing: "-0.04em",
}));

const BrandDescription = styled(Typography)(({ theme }) => ({
  maxWidth: 460,
  color: theme.palette.text.secondary,
}));

interface AuthShellProps {
  children: ReactNode;
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <AuthRoot container>
      <FormPanel size={{ xs: 12, md: 6 }}>
        <FormPanelContent>
          <LogoContainer>
            <LumosLogo />
          </LogoContainer>

          <FormArea>
            <FormContainer>{children}</FormContainer>
          </FormArea>
        </FormPanelContent>
      </FormPanel>

      <BrandPanel size={{ xs: 0, md: 6 }}>
        <BrandMessage>
          <BrandHeadline variant="h3">
            Turn meetings into execution.
          </BrandHeadline>

          <BrandDescription variant="body1">
            Capture commitments, resolve missing ownership and keep execution
            moving after every meeting.
          </BrandDescription>
        </BrandMessage>
      </BrandPanel>
    </AuthRoot>
  );
}
