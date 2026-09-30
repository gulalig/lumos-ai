"use client";

import {
  ArrowForwardRounded,
  CheckCircleRounded,
  ScheduleRounded,
} from "@mui/icons-material";
import { Box, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

import { CtaButton } from "@/components/ui/CtaButton";
import { ROUTES } from "@/constants/routes";

const BRAND = "#C89B5B";
const BRAND_DARK = "#A9793C";
const BRAND_SOFT = "#F7F0E6";

const JIRA_BLUE = "#1868DB";
const SUCCESS = "#477A57";
const SUCCESS_SOFT = "#EEF7F1";

const SectionRoot = styled(Box)(({ theme }) => ({
  position: "relative",

  padding: theme.spacing(13, 3),

  borderTop: `1px solid ${theme.palette.divider}`,

  backgroundColor: theme.palette.background.paper,

  [theme.breakpoints.up("lg")]: {
    paddingInline: 0,
  },
}));

const SectionContainer = styled(Box)({
  width: "100%",

  maxWidth: 1180,

  marginInline: "auto",
});

const SectionLayout = styled(Box)(({ theme }) => ({
  display: "grid",

  gridTemplateColumns: "0.9fr 1.1fr",

  alignItems: "center",

  gap: theme.spacing(9),

  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "1fr",

    gap: theme.spacing(7),
  },
}));

const Content = styled(Box)(({ theme }) => ({
  display: "grid",

  maxWidth: 520,

  gap: theme.spacing(2),
}));

const Eyebrow = styled(Typography)({
  color: BRAND_DARK,

  fontSize: 13,

  fontWeight: 750,

  letterSpacing: "0.02em",
});

const Title = styled("h2")(({ theme }) => ({
  margin: 0,

  color: theme.palette.text.primary,

  fontFamily: theme.typography.fontFamily,

  fontSize: "clamp(42px, 4.8vw, 62px)",

  fontWeight: 720,

  lineHeight: 1.03,

  letterSpacing: "-0.05em",
}));

const Accent = styled("span")({
  color: BRAND_DARK,
});

const Description = styled(Typography)(({ theme }) => ({
  maxWidth: 500,

  color: theme.palette.text.secondary,

  fontSize: 16,

  lineHeight: 1.75,
}));

const Benefits = styled(Box)(({ theme }) => ({
  display: "grid",

  gap: theme.spacing(1.6),

  marginTop: theme.spacing(1.5),
}));

const Benefit = styled(Box)(({ theme }) => ({
  display: "grid",

  gridTemplateColumns: "22px minmax(0, 1fr)",

  alignItems: "start",

  gap: theme.spacing(1.2),
}));

const BenefitIcon = styled(Box)({
  display: "grid",

  placeItems: "center",

  width: 22,

  height: 22,

  marginTop: 1,

  borderRadius: "50%",

  backgroundColor: BRAND_SOFT,

  color: BRAND_DARK,
});

const BenefitText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,

  fontSize: 14,

  lineHeight: 1.6,
}));

const Actions = styled(Box)(({ theme }) => ({
  display: "flex",

  marginTop: theme.spacing(2),
}));

const VisualStage = styled(Box)(({ theme }) => ({
  position: "relative",

  overflow: "hidden",

  padding: theme.spacing(4),

  border: `1px solid ${theme.palette.divider}`,

  borderRadius: 24,

  backgroundColor: "#F8F8F7",

  boxShadow: "0 24px 60px rgba(30, 25, 20, 0.06)",

  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(2),
  },
}));

const VisualHeader = styled(Box)(({ theme }) => ({
  display: "flex",

  alignItems: "center",

  justifyContent: "space-between",

  gap: theme.spacing(2),

  marginBottom: theme.spacing(3),
}));

const VisualHeaderLeft = styled(Box)(({ theme }) => ({
  display: "flex",

  alignItems: "center",

  gap: theme.spacing(1.2),
}));

const LumosMark = styled(Box)({
  display: "grid",

  placeItems: "center",

  width: 38,

  height: 38,

  borderRadius: 11,

  backgroundColor: BRAND_SOFT,

  color: BRAND_DARK,

  fontSize: 13,

  fontWeight: 800,
});

const VisualTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,

  fontSize: 14,

  fontWeight: 720,
}));

const VisualSubtitle = styled(Typography)(({ theme }) => ({
  marginTop: 2,

  color: theme.palette.text.secondary,

  fontSize: 11,
}));

const ConnectedBadge = styled(Box)({
  display: "flex",

  alignItems: "center",

  gap: 6,

  padding: "7px 10px",

  borderRadius: 999,

  backgroundColor: SUCCESS_SOFT,

  color: SUCCESS,

  fontSize: 10,

  fontWeight: 700,
});

const Flow = styled(Box)(({ theme }) => ({
  display: "grid",

  gap: theme.spacing(2),
}));

const MeetingCard = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2.5),

  border: `1px solid ${theme.palette.divider}`,

  borderRadius: 16,

  backgroundColor: theme.palette.background.paper,
}));

const CardEyebrow = styled(Typography)({
  marginBottom: 8,

  color: BRAND_DARK,

  fontSize: 9,

  fontWeight: 800,

  letterSpacing: "0.08em",

  textTransform: "uppercase",
});

const CommitmentTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,

  fontSize: 17,

  fontWeight: 720,

  lineHeight: 1.35,
}));

const CommitmentMeta = styled(Box)(({ theme }) => ({
  display: "flex",

  flexWrap: "wrap",

  gap: theme.spacing(0.8),

  marginTop: theme.spacing(1.5),
}));

const MetaPill = styled(Box)(({ theme }) => ({
  padding: theme.spacing(0.55, 0.9),

  borderRadius: 999,

  backgroundColor: "#F3F3F3",

  color: theme.palette.text.secondary,

  fontSize: 10,

  fontWeight: 650,
}));

const Connector = styled(Box)(({ theme }) => ({
  display: "flex",

  alignItems: "center",

  justifyContent: "center",

  gap: theme.spacing(1),

  minHeight: 34,

  color: theme.palette.text.secondary,
}));

const ConnectorLine = styled(Box)(({ theme }) => ({
  width: 56,

  height: 1,

  backgroundColor: theme.palette.divider,
}));

const ConnectorText = styled(Typography)({
  color: BRAND_DARK,

  fontSize: 10,

  fontWeight: 750,

  letterSpacing: "0.04em",

  textTransform: "uppercase",
});

const JiraCard = styled(Box)(({ theme }) => ({
  overflow: "hidden",

  border: `1px solid ${theme.palette.divider}`,

  borderRadius: 16,

  backgroundColor: theme.palette.background.paper,
}));

const JiraHeader = styled(Box)(({ theme }) => ({
  display: "flex",

  alignItems: "center",

  justifyContent: "space-between",

  gap: theme.spacing(2),

  padding: theme.spacing(2, 2.25),

  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const JiraIdentity = styled(Box)(({ theme }) => ({
  display: "flex",

  alignItems: "center",

  gap: theme.spacing(1.2),
}));

const JiraLogoBox = styled(Box)({
  display: "grid",

  placeItems: "center",

  width: 38,

  height: 38,

  borderRadius: 10,

  backgroundColor: "#F2F6FD",
});

const JiraLogo = styled("svg")({
  width: 22,

  height: 22,

  display: "block",
});

const JiraName = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,

  fontSize: 14,

  fontWeight: 720,
}));

const JiraProject = styled(Typography)(({ theme }) => ({
  marginTop: 2,

  color: theme.palette.text.secondary,

  fontSize: 10,
}));

const IssueStatus = styled(Box)({
  padding: "6px 9px",

  borderRadius: 999,

  backgroundColor: "#EDF4FF",

  color: JIRA_BLUE,

  fontSize: 10,

  fontWeight: 700,
});

const JiraBody = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2.25),
}));

const IssueKey = styled(Typography)({
  marginBottom: 6,

  color: JIRA_BLUE,

  fontSize: 10,

  fontWeight: 750,

  letterSpacing: "0.04em",
});

const IssueTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,

  fontSize: 16,

  fontWeight: 720,

  lineHeight: 1.35,
}));

const IssueDetails = styled(Box)(({ theme }) => ({
  display: "grid",

  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",

  gap: theme.spacing(1),

  marginTop: theme.spacing(2),

  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
  },
}));

const IssueDetail = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.2),

  borderRadius: 10,

  backgroundColor: "#F7F7F7",
}));

const DetailLabel = styled(Typography)(({ theme }) => ({
  marginBottom: 3,

  color: theme.palette.text.disabled,

  fontSize: 9,

  fontWeight: 700,

  textTransform: "uppercase",

  letterSpacing: "0.06em",
}));

const DetailValue = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,

  fontSize: 11,

  fontWeight: 650,
}));

const SyncFooter = styled(Box)(({ theme }) => ({
  display: "flex",

  alignItems: "center",

  justifyContent: "space-between",

  gap: theme.spacing(2),

  marginTop: theme.spacing(2),

  paddingTop: theme.spacing(1.75),

  borderTop: `1px solid ${theme.palette.divider}`,
}));

const SyncState = styled(Box)({
  display: "flex",

  alignItems: "center",

  gap: 6,

  color: SUCCESS,
});

const SyncStateText = styled(Typography)({
  fontSize: 10,

  fontWeight: 700,
});

const SyncTime = styled(Box)(({ theme }) => ({
  display: "flex",

  alignItems: "center",

  gap: 5,

  color: theme.palette.text.secondary,
}));

const SyncTimeText = styled(Typography)({
  fontSize: 10,
});

const BENEFITS = [
  "Choose the Jira project your team already works in.",
  "Create issues from resolved meeting commitments.",
  "Carry ownership and due dates into execution.",
  "Keep work connected after the meeting ends.",
] as const;

function JiraMark() {
  return (
    <JiraLogo viewBox="0 0 24 24" role="img" aria-label="Jira">
      <path
        fill={JIRA_BLUE}
        d="M11.53 2.05 3.28 10.3a.98.98 0 0 0 0 1.39l8.25 8.25a.98.98 0 0 0 1.39 0l8.25-8.25a.98.98 0 0 0 0-1.39l-8.25-8.25a.98.98 0 0 0-1.39 0Zm.69 4.09 4.48 4.48-2.18 2.18-2.3-2.3-2.3 2.3-2.18-2.18 4.48-4.48Zm0 5.75 2.3 2.3-2.3 2.3-2.3-2.3 2.3-2.3Z"
      />
    </JiraLogo>
  );
}

export function IntegrationsSection() {
  return (
    <SectionRoot id="integrations">
      <SectionContainer>
        <SectionLayout>
          <Content>
            <Eyebrow>Integrations</Eyebrow>

            <Title>
              Meeting outcomes,
              <br />
              <Accent>ready in Jira.</Accent>
            </Title>

            <Description>
              Lumos turns resolved meeting commitments into structured work your
              team can continue inside Jira — with the owner, timing and context
              already attached.
            </Description>

            <Benefits>
              {BENEFITS.map((benefit) => (
                <Benefit key={benefit}>
                  <BenefitIcon>
                    <CheckCircleRounded fontSize="inherit" />
                  </BenefitIcon>

                  <BenefitText>{benefit}</BenefitText>
                </Benefit>
              ))}
            </Benefits>

            <Actions>
              <CtaButton href={ROUTES.auth.signup}>Get started</CtaButton>
            </Actions>
          </Content>

          <VisualStage>
            <VisualHeader>
              <VisualHeaderLeft>
                <LumosMark>L</LumosMark>

                <Box>
                  <VisualTitle>Lumos execution</VisualTitle>

                  <VisualSubtitle>Meeting outcome</VisualSubtitle>
                </Box>
              </VisualHeaderLeft>

              <ConnectedBadge>
                <CheckCircleRounded fontSize="inherit" />
                Jira connected
              </ConnectedBadge>
            </VisualHeader>

            <Flow>
              <MeetingCard>
                <CardEyebrow>Resolved commitment</CardEyebrow>

                <CommitmentTitle>Launch the new pricing page</CommitmentTitle>

                <CommitmentMeta>
                  <MetaPill>Owner · Maya</MetaPill>

                  <MetaPill>Due · Friday</MetaPill>

                  <MetaPill>Website launch</MetaPill>
                </CommitmentMeta>
              </MeetingCard>

              <Connector>
                <ConnectorLine />

                <ConnectorText>Create issue</ConnectorText>

                <ArrowForwardRounded fontSize="small" />

                <ConnectorLine />
              </Connector>

              <JiraCard>
                <JiraHeader>
                  <JiraIdentity>
                    <JiraLogoBox>
                      <JiraMark />
                    </JiraLogoBox>

                    <Box>
                      <JiraName>Jira</JiraName>

                      <JiraProject>SCRUM · Lumos AI</JiraProject>
                    </Box>
                  </JiraIdentity>

                  <IssueStatus>To Do</IssueStatus>
                </JiraHeader>

                <JiraBody>
                  <IssueKey>SCRUM-142</IssueKey>

                  <IssueTitle>Launch the new pricing page</IssueTitle>

                  <IssueDetails>
                    <IssueDetail>
                      <DetailLabel>Assignee</DetailLabel>

                      <DetailValue>Maya</DetailValue>
                    </IssueDetail>

                    <IssueDetail>
                      <DetailLabel>Due</DetailLabel>

                      <DetailValue>Friday</DetailValue>
                    </IssueDetail>

                    <IssueDetail>
                      <DetailLabel>Source</DetailLabel>

                      <DetailValue>Lumos meeting</DetailValue>
                    </IssueDetail>
                  </IssueDetails>

                  <SyncFooter>
                    <SyncState>
                      <CheckCircleRounded fontSize="inherit" />

                      <SyncStateText>Synced to Jira</SyncStateText>
                    </SyncState>

                    <SyncTime>
                      <ScheduleRounded fontSize="inherit" />

                      <SyncTimeText>just now</SyncTimeText>
                    </SyncTime>
                  </SyncFooter>
                </JiraBody>
              </JiraCard>
            </Flow>
          </VisualStage>
        </SectionLayout>
      </SectionContainer>
    </SectionRoot>
  );
}
