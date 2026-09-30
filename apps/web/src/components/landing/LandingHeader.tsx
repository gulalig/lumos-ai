"use client";

import { Box, Button } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useState } from "react";

import { LumosLogo } from "@/components/brand/LumosLogo";
import { CtaButton } from "@/components/ui/CtaButton";
import { LANDING_NAVIGATION } from "@/config/landing-navigation";
import { ROUTES } from "@/constants/routes";
import { DemoEntryDialog } from "@/features/demo/DemoEntryDialog";

const HeaderRoot = styled(Box)(({ theme }) => ({
  position: "sticky",
  top: 0,
  zIndex: 100,

  width: "100%",

  borderBottom: `1px solid ${theme.palette.divider}`,

  backgroundColor: "rgba(255, 255, 255, 0.92)",

  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
}));

const HeaderContainer = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "center",

  width: "100%",
  maxWidth: 1180,
  minHeight: 72,

  marginInline: "auto",

  paddingInline: theme.spacing(3),

  [theme.breakpoints.up("lg")]: {
    paddingInline: 0,
  },
}));

const Navigation = styled(Box)(({ theme }) => ({
  display: "none",
  alignItems: "center",
  justifyContent: "center",
  gap: theme.spacing(4),

  [theme.breakpoints.up("md")]: {
    display: "flex",
  },
}));

const NavigationLink = styled("a")(({ theme }) => ({
  position: "relative",

  color: theme.palette.text.secondary,

  fontSize: theme.typography.body2.fontSize,

  fontWeight: theme.typography.fontWeightMedium,

  textDecoration: "none",

  transition: "color 160ms ease",

  "&:hover": {
    color: theme.palette.text.primary,
  },

  "&::after": {
    content: '""',
    position: "absolute",
    right: 0,
    bottom: -8,
    left: 0,
    height: 1,
    backgroundColor: "#C89B5B",
    opacity: 0,
    transform: "scaleX(0.65)",
    transition: "opacity 160ms ease, transform 160ms ease",
  },

  "&:hover::after": {
    opacity: 1,
    transform: "scaleX(1)",
  },
}));

const Actions = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: theme.spacing(1),
}));

const DemoButton = styled(Button)({
  minHeight: 38,

  paddingInline: 18,

  borderRadius: 999,

  backgroundColor: "#171717",

  color: "#FFFFFF",

  fontSize: 13,

  fontWeight: 700,

  textTransform: "none",

  "&:hover": {
    backgroundColor: "#2A2A2A",
  },
});

export function LandingHeader() {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <>
      <HeaderRoot>
        <HeaderContainer>
          <LumosLogo />

          <Navigation>
            {LANDING_NAVIGATION.map((item) => (
              <NavigationLink key={item.href} href={item.href}>
                {item.label}
              </NavigationLink>
            ))}
          </Navigation>

          <Actions>
            <CtaButton href={ROUTES.auth.login} variant="login">
              Login
            </CtaButton>

            <CtaButton href={ROUTES.auth.signup} variant="secondary">
              Start for free
            </CtaButton>

            <DemoButton type="button" onClick={() => setDemoOpen(true)}>
              Try demo
            </DemoButton>
          </Actions>
        </HeaderContainer>
      </HeaderRoot>

      <DemoEntryDialog open={demoOpen} onClose={() => setDemoOpen(false)} />
    </>
  );
}
