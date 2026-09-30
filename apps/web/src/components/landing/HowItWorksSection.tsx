"use client";

import {
  ChatBubbleOutlineRounded,
  CheckCircleOutlineRounded,
  HelpOutlineRounded,
  TaskAltRounded,
} from "@mui/icons-material";
import { Box, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

const BRAND = "#C89B5B";
const BRAND_DARK = "#A9793C";
const BRAND_SOFT = "#F7F0E6";

const SectionRoot = styled(Box)(({ theme }) => ({
  position: "relative",
  overflow: "hidden",
  padding: theme.spacing(13, 3),
  backgroundColor: "#F8F7F5",

  [theme.breakpoints.up("lg")]: {
    paddingInline: 0,
  },
}));

const SectionContainer = styled(Box)({
  width: "100%",
  maxWidth: 1180,
  marginInline: "auto",
});

const SectionHeader = styled(Box)(({ theme }) => ({
  display: "grid",
  maxWidth: 760,
  gap: theme.spacing(2),
  marginBottom: theme.spacing(8),
}));

const Eyebrow = styled(Typography)({
  color: BRAND_DARK,
  fontSize: 13,
  fontWeight: 750,
  letterSpacing: "0.02em",
});

const SectionTitle = styled("h2")(({ theme }) => ({
  maxWidth: 720,
  margin: 0,
  color: theme.palette.text.primary,
  fontFamily: theme.typography.fontFamily,
  fontSize: "clamp(42px, 5vw, 64px)",
  fontWeight: 720,
  lineHeight: 1.02,
  letterSpacing: "-0.05em",
}));

const Accent = styled("span")({
  color: BRAND_DARK,
});

const SectionDescription = styled(Typography)(({ theme }) => ({
  maxWidth: 680,
  color: theme.palette.text.secondary,
  fontSize: 17,
  lineHeight: 1.7,
}));

const Flow = styled(Box)(({ theme }) => ({
  position: "relative",
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: theme.spacing(2),

  "&::before": {
    content: '""',
    position: "absolute",
    top: 34,
    left: "9%",
    right: "9%",
    zIndex: 0,
    height: 1,
    backgroundColor: "#DED8CF",
  },

  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: theme.spacing(3),

    "&::before": {
      display: "none",
    },
  },

  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
  },
}));

const Step = styled(Box)(({ theme }) => ({
  position: "relative",
  zIndex: 1,
  display: "flex",
  minWidth: 0,
  flexDirection: "column",
  minHeight: 360,
  padding: theme.spacing(3),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 18,
  backgroundColor: theme.palette.background.paper,
  transition:
    "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",

  "&:hover": {
    transform: "translateY(-4px)",
    borderColor: "#D9C5A7",
    boxShadow: "0 18px 40px rgba(38, 31, 22, 0.07)",
  },

  [theme.breakpoints.down("md")]: {
    minHeight: 330,
  },

  [theme.breakpoints.down("sm")]: {
    minHeight: 0,
  },
}));

const StepTop = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(2),
}));

const StepIcon = styled(Box)({
  display: "grid",
  placeItems: "center",
  width: 48,
  height: 48,
  borderRadius: 14,
  backgroundColor: BRAND_SOFT,
  color: BRAND_DARK,
});

const StepNumber = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.disabled,
  fontSize: 11,
  fontWeight: 750,
  letterSpacing: "0.08em",
}));

const StepContent = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(1.5),
  marginTop: theme.spacing(4),
}));

const StepTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: 20,
  fontWeight: 720,
  lineHeight: 1.25,
  letterSpacing: "-0.025em",
}));

const StepDescription = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: 14,
  lineHeight: 1.7,
}));

const StepFooter = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
  marginTop: "auto",
  paddingTop: theme.spacing(3),
}));

const OutputLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.disabled,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
}));

const OutputPill = styled(Box)({
  padding: "6px 9px",
  borderRadius: 999,
  backgroundColor: BRAND_SOFT,
  color: BRAND_DARK,
  fontSize: 10,
  fontWeight: 700,
});

const STEPS = [
  {
    number: "01",
    icon: ChatBubbleOutlineRounded,
    title: "Capture the conversation",
    description:
      "Lumos listens as the meeting unfolds and turns raw conversation into structured context.",
    output: "Live context",
  },
  {
    number: "02",
    icon: CheckCircleOutlineRounded,
    title: "Detect what matters",
    description:
      "Decisions, commitments, owners and execution signals are identified as they appear.",
    output: "Decisions + tasks",
  },
  {
    number: "03",
    icon: HelpOutlineRounded,
    title: "Clarify what is missing",
    description:
      "When ownership or timing is unclear, Lumos detects the gap and asks for the missing detail.",
    output: "Resolved context",
  },
  {
    number: "04",
    icon: TaskAltRounded,
    title: "Move work into execution",
    description:
      "Resolved commitments become trackable work that can continue into Jira and delivery.",
    output: "Execution ready",
  },
] as const;

export function HowItWorksSection() {
  return (
    <SectionRoot id="how-it-works">
      <SectionContainer>
        <SectionHeader>
          <Eyebrow>How it works</Eyebrow>

          <SectionTitle>
            From conversation to <Accent>execution.</Accent>
          </SectionTitle>

          <SectionDescription>
            Lumos follows the meeting in real time, understands what matters,
            resolves missing context and turns the result into work your team
            can actually execute.
          </SectionDescription>
        </SectionHeader>

        <Flow>
          {STEPS.map((step) => {
            const Icon = step.icon;

            return (
              <Step key={step.number}>
                <StepTop>
                  <StepIcon>
                    <Icon fontSize="small" />
                  </StepIcon>

                  <StepNumber>{step.number}</StepNumber>
                </StepTop>

                <StepContent>
                  <StepTitle>{step.title}</StepTitle>

                  <StepDescription>{step.description}</StepDescription>
                </StepContent>

                <StepFooter>
                  <OutputLabel>Output</OutputLabel>

                  <OutputPill>{step.output}</OutputPill>
                </StepFooter>
              </Step>
            );
          })}
        </Flow>
      </SectionContainer>
    </SectionRoot>
  );
}
