"use client";

import {
  CheckCircleRounded,
  HelpOutlineRounded,
  RecordVoiceOverRounded,
  SyncRounded,
  TaskAltRounded,
} from "@mui/icons-material";
import { Box, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

import { HERO_TRANSCRIPT } from "./hero-demo.data";
import { useHeroDemo } from "./useHeroDemo";

const BRAND = "#C89B5B";

const BRAND_DARK = "#A9793C";

const BRAND_SOFT = "#F7F0E6";

const SUCCESS = "#477A57";

const SUCCESS_SOFT = "#EEF7F1";

const WARNING = "#A56A16";

const WARNING_SOFT = "#FFF7E8";

interface RevealProps {
  visible: boolean;
}

interface TranscriptProps extends RevealProps {
  active?: boolean;
}

const DemoScene = styled(Box)({
  position: "relative",

  width: "100%",

  maxWidth: 1180,

  marginInline: "auto",

  paddingTop: 64,

  paddingBottom: 30,
});

const BackgroundAsset = styled("img")(({ theme }) => ({
  position: "absolute",

  top: -105,

  left: "50%",

  zIndex: 0,

  width: "148%",

  maxWidth: 1700,

  height: 820,

  objectFit: "contain",

  objectPosition: "center",

  pointerEvents: "none",

  userSelect: "none",

  transform: "translateX(-50%)",

  opacity: 0.96,

  [theme.breakpoints.down("lg")]: {
    width: "150%",

    height: 760,
  },

  [theme.breakpoints.down("md")]: {
    top: -55,

    width: "175%",

    height: 650,

    opacity: 0.76,
  },

  [theme.breakpoints.down("sm")]: {
    width: "210%",

    height: 600,

    opacity: 0.58,
  },
}));

const ProductWindow = styled(Box)(({ theme }) => ({
  position: "relative",

  zIndex: 1,

  overflow: "hidden",

  width: "calc(100% - 48px)",

  maxWidth: 1060,

  minHeight: 590,

  marginInline: "auto",

  border: `1px solid ${theme.palette.divider}`,

  borderRadius: 22,

  backgroundColor: theme.palette.background.paper,

  boxShadow: "0 28px 80px rgba(28, 24, 20, 0.14)",

  [theme.breakpoints.down("sm")]: {
    width: "calc(100% - 24px)",

    minHeight: 0,

    borderRadius: 16,
  },
}));

const WindowBar = styled(Box)(({ theme }) => ({
  display: "grid",

  gridTemplateColumns: "1fr auto 1fr",

  alignItems: "center",

  minHeight: 60,

  paddingInline: theme.spacing(2),

  borderBottom: `1px solid ${theme.palette.divider}`,

  backgroundColor: "#FBFBFB",

  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr auto",
  },
}));

const WindowDots = styled(Box)(({ theme }) => ({
  display: "flex",

  gap: theme.spacing(0.7),
}));

const Dot = styled(Box)({
  width: 9,

  height: 9,

  borderRadius: "50%",

  backgroundColor: "#D8D5D1",
});

const MeetingIdentity = styled(Box)({
  textAlign: "center",
});

const MeetingTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,

  fontSize: 13,

  fontWeight: 700,
}));

const MeetingMeta = styled(Typography)(({ theme }) => ({
  marginTop: 2,

  color: theme.palette.text.secondary,

  fontSize: 10,
}));

const LiveBadge = styled(Box)(({ theme }) => ({
  display: "flex",

  alignItems: "center",

  justifySelf: "end",

  gap: theme.spacing(0.7),

  padding: theme.spacing(0.55, 1),

  border: `1px solid ${theme.palette.divider}`,

  borderRadius: 999,

  backgroundColor: theme.palette.background.paper,
}));

const LiveDot = styled(Box)({
  width: 7,

  height: 7,

  borderRadius: "50%",

  backgroundColor: BRAND,

  animation: "heroLivePulse 1.35s ease-in-out infinite",

  "@keyframes heroLivePulse": {
    "0%, 100%": {
      opacity: 0.35,
    },

    "50%": {
      opacity: 1,
    },
  },
});

const LiveLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,

  fontSize: 10,

  fontWeight: 750,

  letterSpacing: "0.08em",

  textTransform: "uppercase",
}));

const DemoLayout = styled(Box)(({ theme }) => ({
  display: "grid",

  gridTemplateColumns: "0.92fr 1.08fr",

  minHeight: 530,

  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "1fr",
  },
}));

const TranscriptPane = styled(Box)(({ theme }) => ({
  minWidth: 0,

  padding: theme.spacing(3),

  borderRight: `1px solid ${theme.palette.divider}`,

  backgroundColor: "#FCFCFC",

  [theme.breakpoints.down("md")]: {
    borderRight: 0,

    borderBottom: `1px solid ${theme.palette.divider}`,
  },
}));

const IntelligencePane = styled(Box)(({ theme }) => ({
  minWidth: 0,

  padding: theme.spacing(3),

  backgroundColor: theme.palette.background.paper,
}));

const PaneHeader = styled(Box)(({ theme }) => ({
  display: "flex",

  alignItems: "center",

  justifyContent: "space-between",

  minHeight: 30,

  marginBottom: theme.spacing(2.5),
}));

const PaneTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,

  fontSize: 11,

  fontWeight: 800,

  letterSpacing: "0.07em",

  textTransform: "uppercase",
}));

const Listening = styled(Box)(({ theme }) => ({
  display: "flex",

  alignItems: "center",

  gap: theme.spacing(0.7),

  color: BRAND_DARK,
}));

const ListeningLabel = styled(Typography)({
  fontSize: 11,

  fontWeight: 650,
});

const ActivityWave = styled(Box)(({ theme }) => ({
  display: "flex",

  alignItems: "center",

  justifyContent: "center",

  gap: theme.spacing(0.28),

  width: 18,

  height: 16,
}));

interface ActivityBarProps {
  delay: number;
}

const ActivityBar = styled(Box, {
  shouldForwardProp: (prop) => prop !== "delay",
})<ActivityBarProps>(({ delay }) => ({
  width: 2,

  height: 6,

  borderRadius: 999,

  backgroundColor: "currentColor",

  transformOrigin: "center",

  animation: "lumosActivityWave 760ms ease-in-out infinite alternate",

  animationDelay: `${delay}ms`,

  "@keyframes lumosActivityWave": {
    "0%": {
      height: 4,

      opacity: 0.45,
    },

    "100%": {
      height: 13,

      opacity: 1,
    },
  },
}));

const StatusPulse = styled(Box)({
  width: 6,

  height: 6,

  borderRadius: "50%",

  backgroundColor: "currentColor",

  animation: "lumosStatusPulse 1.3s ease-in-out infinite",

  "@keyframes lumosStatusPulse": {
    "0%, 100%": {
      opacity: 0.35,

      transform: "scale(0.85)",
    },

    "50%": {
      opacity: 1,

      transform: "scale(1)",
    },
  },
});

const TranscriptList = styled(Box)(({ theme }) => ({
  display: "grid",

  gap: theme.spacing(0.75),
}));

const TranscriptItem = styled(Box, {
  shouldForwardProp: (prop) => prop !== "visible" && prop !== "active",
})<TranscriptProps>(({ theme, visible, active }) => ({
  display: "grid",

  gridTemplateColumns: "36px minmax(0, 1fr)",

  gap: theme.spacing(1.2),

  padding: theme.spacing(1.15),

  border: active ? "1px solid #E4CEAD" : "1px solid transparent",

  borderRadius: 12,

  backgroundColor: active ? "#FBF7F0" : "transparent",

  opacity: visible ? 1 : 0,

  transform: visible ? "translateY(0)" : "translateY(8px)",

  transition:
    "opacity 300ms ease, transform 300ms ease, background-color 300ms ease, border-color 300ms ease",
}));

const SpeakerAvatar = styled(Box)({
  display: "grid",

  placeItems: "center",

  width: 36,

  height: 36,

  borderRadius: "50%",

  backgroundColor: BRAND_SOFT,

  color: BRAND_DARK,

  fontSize: 10,

  fontWeight: 800,
});

const SpeakerName = styled(Typography)(({ theme }) => ({
  marginBottom: 3,

  color: theme.palette.text.primary,

  fontSize: 12,

  fontWeight: 700,
}));

const TranscriptText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,

  fontSize: 12,

  lineHeight: 1.55,
}));

const IntelligenceStack = styled(Box)(({ theme }) => ({
  display: "grid",

  gap: theme.spacing(1.3),
}));

const IntelligenceCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== "visible",
})<RevealProps>(({ theme, visible }) => ({
  display: "grid",

  gridTemplateColumns: "38px minmax(0, 1fr)",

  gap: theme.spacing(1.4),

  padding: theme.spacing(1.65),

  border: `1px solid ${theme.palette.divider}`,

  borderRadius: 14,

  backgroundColor: theme.palette.background.paper,

  opacity: visible ? 1 : 0,

  transform: visible ? "translateY(0)" : "translateY(7px)",

  transition: "opacity 320ms ease, transform 320ms ease",
}));

const IntelligenceIcon = styled(Box)({
  display: "grid",

  placeItems: "center",

  width: 38,

  height: 38,

  borderRadius: 11,

  backgroundColor: BRAND_SOFT,

  color: BRAND_DARK,
});

const WarningIcon = styled(IntelligenceIcon)({
  backgroundColor: WARNING_SOFT,

  color: WARNING,
});

const VoiceIcon = styled(IntelligenceIcon)({
  backgroundColor: "#F4EFE8",

  color: BRAND_DARK,
});

const SuccessIcon = styled(IntelligenceIcon)({
  backgroundColor: SUCCESS_SOFT,

  color: SUCCESS,
});

const CardBody = styled(Box)({
  minWidth: 0,
});

const CardEyebrow = styled(Typography)({
  marginBottom: 3,

  color: BRAND_DARK,

  fontSize: 9,

  fontWeight: 800,

  letterSpacing: "0.08em",

  textTransform: "uppercase",
});

const WarningEyebrow = styled(CardEyebrow)({
  color: WARNING,
});

const SuccessEyebrow = styled(CardEyebrow)({
  color: SUCCESS,
});

const CardTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,

  fontSize: 14,

  fontWeight: 700,

  lineHeight: 1.45,
}));

const CardDescription = styled(Typography)(({ theme }) => ({
  marginTop: 4,

  color: theme.palette.text.secondary,

  fontSize: 11,

  lineHeight: 1.55,
}));

const Pills = styled(Box)(({ theme }) => ({
  display: "flex",

  flexWrap: "wrap",

  gap: theme.spacing(0.65),

  marginTop: theme.spacing(1),
}));

const Pill = styled(Box)(({ theme }) => ({
  padding: theme.spacing(0.45, 0.8),

  borderRadius: 999,

  backgroundColor: "#F4F4F4",

  color: theme.palette.text.secondary,

  fontSize: 10,

  fontWeight: 650,
}));

const MissingPill = styled(Pill)({
  backgroundColor: WARNING_SOFT,

  color: WARNING,
});

const ResolvedPill = styled(Pill)({
  backgroundColor: SUCCESS_SOFT,

  color: SUCCESS,
});

const LumosSpeechCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== "visible",
})<RevealProps>(({ theme, visible }) => ({
  position: "relative",

  display: "grid",

  gridTemplateColumns: "38px minmax(0, 1fr)",

  gap: theme.spacing(1.4),

  padding: theme.spacing(1.65),

  border: "1px solid #DDC7A5",

  borderRadius: 14,

  backgroundColor: "#FBF7F0",

  opacity: visible ? 1 : 0,

  transform: visible ? "translateY(0)" : "translateY(7px)",

  transition: "opacity 320ms ease, transform 320ms ease",
}));

const SpeechHeader = styled(Box)(({ theme }) => ({
  display: "flex",

  alignItems: "center",

  gap: theme.spacing(0.8),

  marginBottom: 4,
}));

const SpeakingIndicator = styled(Box)(({ theme }) => ({
  display: "flex",

  alignItems: "center",

  gap: theme.spacing(0.3),
}));

const SoundBar = styled(Box)({
  width: 2,

  borderRadius: 999,

  backgroundColor: BRAND_DARK,

  animation: "lumosVoiceWave 700ms ease-in-out infinite alternate",

  "@keyframes lumosVoiceWave": {
    from: {
      height: 5,
    },

    to: {
      height: 13,
    },
  },

  "&:nth-of-type(2)": {
    animationDelay: "140ms",
  },

  "&:nth-of-type(3)": {
    animationDelay: "280ms",
  },
});

const JiraCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== "visible",
})<RevealProps>(({ theme, visible }) => ({
  display: "grid",

  gridTemplateColumns: "42px minmax(0, 1fr) auto",

  alignItems: "center",

  gap: theme.spacing(1.3),

  padding: theme.spacing(1.5),

  border: `1px solid ${theme.palette.divider}`,

  borderRadius: 14,

  backgroundColor: "#FAFAFA",

  opacity: visible ? 1 : 0,

  transform: visible ? "translateY(0)" : "translateY(7px)",

  transition: "opacity 320ms ease, transform 320ms ease",
}));

const JiraMark = styled(Box)({
  display: "grid",

  placeItems: "center",

  width: 42,

  height: 42,

  borderRadius: 11,

  backgroundColor: "#F2F5FB",

  color: "#2456A6",

  fontSize: 15,

  fontWeight: 850,
});

const JiraStatus = styled(Box)({
  display: "flex",

  alignItems: "center",

  gap: 5,

  color: SUCCESS,

  fontSize: 10,

  fontWeight: 700,
});

export function HeroLiveDemo() {
  const demo = useHeroDemo();

  const transcriptStatus = "Listening";

  const intelligenceStatus = demo.showJira
    ? "Syncing"
    : demo.showResolved
      ? "Updating"
      : demo.lumosSpeaking
        ? "Speaking"
        : demo.showMissingDue
          ? "Reasoning"
          : demo.showAction
            ? "Extracting"
            : "Understanding";

  return (
    <DemoScene id="live-demo">
      <BackgroundAsset src="/bg_img.webp" alt="" aria-hidden="true" />

      <ProductWindow>
        <WindowBar>
          <WindowDots>
            <Dot />
            <Dot />
            <Dot />
          </WindowDots>

          <MeetingIdentity>
            <MeetingTitle>Product planning</MeetingTitle>

            <MeetingMeta>Lumos AI meeting</MeetingMeta>
          </MeetingIdentity>

          <LiveBadge>
            <LiveDot />

            <LiveLabel>Live</LiveLabel>
          </LiveBadge>
        </WindowBar>

        <DemoLayout>
          <TranscriptPane>
            <PaneHeader>
              <PaneTitle>Live transcript</PaneTitle>

              <Listening>
                <ActivityWave aria-hidden="true">
                  <ActivityBar delay={0} />
                  <ActivityBar delay={130} />
                  <ActivityBar delay={260} />
                  <ActivityBar delay={390} />
                </ActivityWave>

                <ListeningLabel>{transcriptStatus}</ListeningLabel>
              </Listening>
            </PaneHeader>

            <TranscriptList>
              <TranscriptItem
                visible={demo.showReleaseTranscript}
                active={demo.step === 1}
              >
                <SpeakerAvatar>
                  {HERO_TRANSCRIPT.release.initials}
                </SpeakerAvatar>

                <Box>
                  <SpeakerName>{HERO_TRANSCRIPT.release.speaker}</SpeakerName>

                  <TranscriptText>
                    {HERO_TRANSCRIPT.release.text}
                  </TranscriptText>
                </Box>
              </TranscriptItem>

              <TranscriptItem
                visible={demo.showTaskTranscript}
                active={demo.step === 3}
              >
                <SpeakerAvatar>{HERO_TRANSCRIPT.task.initials}</SpeakerAvatar>

                <Box>
                  <SpeakerName>{HERO_TRANSCRIPT.task.speaker}</SpeakerName>

                  <TranscriptText>{HERO_TRANSCRIPT.task.text}</TranscriptText>
                </Box>
              </TranscriptItem>

              <TranscriptItem
                visible={demo.showApiTranscript}
                active={demo.step === 4}
              >
                <SpeakerAvatar>{HERO_TRANSCRIPT.api.initials}</SpeakerAvatar>

                <Box>
                  <SpeakerName>{HERO_TRANSCRIPT.api.speaker}</SpeakerName>

                  <TranscriptText>{HERO_TRANSCRIPT.api.text}</TranscriptText>
                </Box>
              </TranscriptItem>

              <TranscriptItem
                visible={demo.showReviewTranscript}
                active={demo.step === 5}
              >
                <SpeakerAvatar>{HERO_TRANSCRIPT.review.initials}</SpeakerAvatar>

                <Box>
                  <SpeakerName>{HERO_TRANSCRIPT.review.speaker}</SpeakerName>

                  <TranscriptText>{HERO_TRANSCRIPT.review.text}</TranscriptText>
                </Box>
              </TranscriptItem>

              <TranscriptItem
                visible={demo.showAnswer}
                active={demo.step === 9}
              >
                <SpeakerAvatar>{HERO_TRANSCRIPT.answer.initials}</SpeakerAvatar>

                <Box>
                  <SpeakerName>{HERO_TRANSCRIPT.answer.speaker}</SpeakerName>

                  <TranscriptText>{HERO_TRANSCRIPT.answer.text}</TranscriptText>
                </Box>
              </TranscriptItem>
            </TranscriptList>
          </TranscriptPane>

          <IntelligencePane>
            <PaneHeader>
              <PaneTitle>Lumos AI</PaneTitle>

              <Listening>
                {demo.lumosSpeaking ? (
                  <ActivityWave aria-hidden="true">
                    <ActivityBar delay={0} />
                    <ActivityBar delay={120} />
                    <ActivityBar delay={240} />
                    <ActivityBar delay={360} />
                  </ActivityWave>
                ) : (
                  <StatusPulse />
                )}

                <ListeningLabel>{intelligenceStatus}</ListeningLabel>
              </Listening>
            </PaneHeader>

            <IntelligenceStack>
              <IntelligenceCard visible={demo.showDecision}>
                <IntelligenceIcon>
                  <CheckCircleRounded fontSize="small" />
                </IntelligenceIcon>

                <CardBody>
                  <CardEyebrow>Decision</CardEyebrow>

                  <CardTitle>Onboarding release moved to Friday</CardTitle>

                  <CardDescription>
                    Lumos captured a concrete decision from the conversation.
                  </CardDescription>
                </CardBody>
              </IntelligenceCard>

              <IntelligenceCard visible={demo.showAction}>
                <IntelligenceIcon>
                  <TaskAltRounded fontSize="small" />
                </IntelligenceIcon>

                <CardBody>
                  <CardEyebrow>Commitment</CardEyebrow>

                  <CardTitle>Fix auth redirect before release</CardTitle>

                  <Pills>
                    <Pill>Maya</Pill>

                    {demo.showResolved ? (
                      <ResolvedPill>Thu · 15:00</ResolvedPill>
                    ) : (
                      <MissingPill>Due date missing</MissingPill>
                    )}
                  </Pills>
                </CardBody>
              </IntelligenceCard>

              <IntelligenceCard visible={demo.showMissingDue}>
                <WarningIcon>
                  <HelpOutlineRounded fontSize="small" />
                </WarningIcon>

                <CardBody>
                  <WarningEyebrow>Missing context</WarningEyebrow>

                  <CardTitle>The commitment has no clear due date.</CardTitle>

                  <CardDescription>
                    Lumos knows what needs to be clarified before execution.
                  </CardDescription>
                </CardBody>
              </IntelligenceCard>

              <LumosSpeechCard visible={demo.lumosSpeaking}>
                <VoiceIcon>
                  <RecordVoiceOverRounded fontSize="small" />
                </VoiceIcon>

                <CardBody>
                  <SpeechHeader>
                    <CardEyebrow>Lumos AI spoke</CardEyebrow>

                    {demo.step === 8 ? (
                      <SpeakingIndicator>
                        <SoundBar />
                        <SoundBar />
                        <SoundBar />
                      </SpeakingIndicator>
                    ) : null}
                  </SpeechHeader>

                  <CardTitle>
                    “When should Maya complete the auth redirect?”
                  </CardTitle>

                  <CardDescription>
                    Lumos asks while the conversation context is still fresh.
                  </CardDescription>
                </CardBody>
              </LumosSpeechCard>

              <IntelligenceCard visible={demo.showResolved}>
                <SuccessIcon>
                  <CheckCircleRounded fontSize="small" />
                </SuccessIcon>

                <CardBody>
                  <SuccessEyebrow>Resolved</SuccessEyebrow>

                  <CardTitle>Due date captured</CardTitle>

                  <CardDescription>Maya · Thursday at 15:00</CardDescription>
                </CardBody>
              </IntelligenceCard>

              <JiraCard visible={demo.showJira}>
                <JiraMark>J</JiraMark>

                <CardBody>
                  <SuccessEyebrow>Jira</SuccessEyebrow>

                  <CardTitle>SCRUM-42 · Fix auth redirect</CardTitle>

                  <CardDescription>
                    Maya · Thursday · Ready for execution
                  </CardDescription>
                </CardBody>

                <JiraStatus>
                  <SyncRounded fontSize="inherit" />
                  Synced
                </JiraStatus>
              </JiraCard>
            </IntelligenceStack>
          </IntelligencePane>
        </DemoLayout>
      </ProductWindow>
    </DemoScene>
  );
}
