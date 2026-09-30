"use client";

import { Box, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

import { LumosLogo } from "@/components/brand/LumosLogo";
import { AppLink } from "@/components/navigation/AppLink";
import { LANDING_NAVIGATION } from "@/config/landing-navigation";

const BRAND_DARK = "#A9793C";
const BRAND_SOFT = "#F7F0E6";

const FooterRoot = styled(Box)(({ theme }) => ({
  borderTop: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
}));

const FooterContainer = styled(Box)(({ theme }) => ({
  width: "100%",
  maxWidth: 1180,
  marginInline: "auto",
  padding: theme.spacing(8, 3, 3),

  [theme.breakpoints.up("lg")]: {
    paddingInline: 0,
  },
}));

const FooterMain = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1.15fr 0.65fr 1fr",
  gap: theme.spacing(8),
  alignItems: "start",
  paddingBottom: theme.spacing(7),

  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "1fr 1fr",
    gap: theme.spacing(5),
  },

  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
  },
}));

const BrandColumn = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(2),
  maxWidth: 350,
}));

const BrandDescription = styled(Typography)(({ theme }) => ({
  maxWidth: 320,
  color: theme.palette.text.secondary,
  fontSize: 14,
  lineHeight: 1.7,
}));

const NavigationColumn = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(1.6),
}));

const FooterSectionTitle = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(0.5),
  color: theme.palette.text.primary,
  fontSize: 13,
  fontWeight: 750,
}));

const FooterLink = styled(AppLink)(({ theme }) => ({
  width: "fit-content",
  color: theme.palette.text.secondary,
  fontSize: 14,
  fontWeight: theme.typography.fontWeightRegular,
  textDecoration: "none",
  transition: "color 160ms ease",

  "&:hover": {
    color: BRAND_DARK,
  },
}));

const LumosCard = styled(Box)(({ theme }) => ({
  position: "relative",
  overflow: "hidden",
  minHeight: 170,
  padding: theme.spacing(3),
  border: "1px solid #E4D1B4",
  borderRadius: 18,
  backgroundColor: BRAND_SOFT,
}));

const CardContent = styled(Box)(({ theme }) => ({
  position: "relative",
  zIndex: 1,
  display: "grid",
  gap: theme.spacing(1.2),
}));

const CardEyebrow = styled(Typography)({
  color: BRAND_DARK,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
});

const CardTitle = styled(Typography)(({ theme }) => ({
  maxWidth: 280,
  color: theme.palette.text.primary,
  fontSize: 20,
  fontWeight: 720,
  lineHeight: 1.3,
  letterSpacing: "-0.025em",
}));

const CardDescription = styled(Typography)(({ theme }) => ({
  maxWidth: 290,
  color: theme.palette.text.secondary,
  fontSize: 12,
  lineHeight: 1.6,
}));

const FooterBottom = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
  paddingTop: theme.spacing(3),
  borderTop: `1px solid ${theme.palette.divider}`,

  [theme.breakpoints.up("sm")]: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
}));

const Copyright = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: 13,
}));

const FooterBottomLinks = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(2.5),
}));

export function LandingFooter() {
  return (
    <FooterRoot>
      <FooterContainer>
        <FooterMain>
          <BrandColumn>
            <LumosLogo />

            <BrandDescription>
              Turn meetings into clear ownership, commitments and execution.
            </BrandDescription>
          </BrandColumn>

          <NavigationColumn>
            <FooterSectionTitle>Product</FooterSectionTitle>

            {LANDING_NAVIGATION.map((item) => (
              <FooterLink key={item.href} href={item.href}>
                {item.label}
              </FooterLink>
            ))}
          </NavigationColumn>

          <LumosCard>
            <CardContent>
              <CardEyebrow>Lumos AI</CardEyebrow>

              <CardTitle>
                Conversation becomes execution while the context is still fresh.
              </CardTitle>

              <CardDescription>
                Decisions, commitments, missing details and delivery stay
                connected from the meeting onward.
              </CardDescription>
            </CardContent>
          </LumosCard>
        </FooterMain>

        <FooterBottom>
          <Copyright>© 2026 Lumos. All rights reserved.</Copyright>

          <FooterBottomLinks>
            <FooterLink href="/privacy">Privacy</FooterLink>

            <FooterLink href="/terms">Terms</FooterLink>
          </FooterBottomLinks>
        </FooterBottom>
      </FooterContainer>
    </FooterRoot>
  );
}
