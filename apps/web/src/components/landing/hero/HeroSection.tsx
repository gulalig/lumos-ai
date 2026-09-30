"use client";

import { ArrowDownwardRounded } from "@mui/icons-material";
import { Box, Button, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

import { HeroLiveDemo } from "./HeroLiveDemo";

const BRAND_DARK = "#A9793C";

const HeroRoot = styled(Box)(({ theme }) => ({
  position: "relative",

  overflow: "hidden",

  scrollMarginTop: 72,

  backgroundColor: theme.palette.background.paper,

  paddingTop: theme.spacing(11),

  paddingBottom: theme.spacing(7),

  [theme.breakpoints.down("md")]: {
    paddingTop: theme.spacing(8),
  },
}));

const HeroContainer = styled(Box)({
  width: "100%",

  maxWidth: 1180,

  marginInline: "auto",
});

const HeroCopy = styled(Box)(({ theme }) => ({
  display: "grid",

  justifyItems: "center",

  maxWidth: 920,

  marginInline: "auto",

  paddingInline: theme.spacing(3),

  textAlign: "center",
}));

const HeroTitle = styled("h1")(({ theme }) => ({
  maxWidth: 900,

  margin: 0,

  color: theme.palette.text.primary,

  fontFamily: theme.typography.fontFamily,

  fontSize: "clamp(48px, 6vw, 78px)",

  fontWeight: 720,

  lineHeight: 0.98,

  letterSpacing: "-0.055em",

  [theme.breakpoints.down("sm")]: {
    fontSize: "clamp(40px, 12vw, 56px)",
  },
}));

const Accent = styled("span")({
  color: BRAND_DARK,
});

const HeroDescription = styled(Typography)(({ theme }) => ({
  maxWidth: 690,

  marginTop: theme.spacing(3),

  color: theme.palette.text.secondary,

  fontSize: 18,

  lineHeight: 1.65,

  [theme.breakpoints.down("sm")]: {
    fontSize: 16,
  },
}));

const HeroAction = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(3.5),

  minHeight: 46,

  paddingInline: theme.spacing(2.2),

  border: `1px solid ${theme.palette.divider}`,

  borderRadius: 999,

  backgroundColor: theme.palette.background.paper,

  color: theme.palette.text.primary,

  textTransform: "none",

  fontWeight: 650,

  boxShadow: "0 4px 14px rgba(20, 20, 20, 0.05)",

  "&:hover": {
    borderColor: "#D8C4A4",

    backgroundColor: "#FBF8F3",

    boxShadow: "0 6px 18px rgba(20, 20, 20, 0.07)",
  },
}));

export function HeroSection() {
  const scrollToDemo = () => {
    document.getElementById("live-demo")?.scrollIntoView({
      behavior: "smooth",

      block: "center",
    });
  };

  return (
    <HeroRoot id="product">
      <HeroContainer>
        <HeroCopy>
          <HeroTitle>
            Meetings don&apos;t end in notes.
            <br />
            <Accent>They move work forward.</Accent>
          </HeroTitle>

          <HeroDescription>
            Lumos AI listens to the conversation, captures decisions and
            commitments, speaks up when critical context is missing, and turns
            resolved work into execution.
          </HeroDescription>

          <HeroAction
            type="button"
            endIcon={<ArrowDownwardRounded fontSize="small" />}
            onClick={scrollToDemo}
          >
            See Lumos in action
          </HeroAction>
        </HeroCopy>

        <HeroLiveDemo />
      </HeroContainer>
    </HeroRoot>
  );
}
