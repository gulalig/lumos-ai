"use client";

import {
  ArrowBackRounded,
  CheckCircleRounded,
  FiberManualRecordRounded,
  LaunchRounded,
  MicRounded,
  StopRounded,
} from "@mui/icons-material";
import { Alert, Avatar, Box, Button, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { ROUTES } from "@/constants/routes";

import { useDemoParticipants } from "@/features/demo/useDemoParticipants";
import { useMeetingRoom } from "@/features/meeting/useMeetingRoom";
import { useMeetingSnapshot } from "@/features/meeting/useMeetingSnapshot";

import { useGetDashboardOverviewQuery } from "@/store/api/dashboard.api";
import { useGetJiraSetupQuery } from "@/store/api/jira.api";

const BRAND = "#C89B5B";
const BRAND_DARK = "#A9793C";
const BRAND_SOFT = "#F7F0E6";

const PageRoot = styled(Box)(({ theme }) => ({
  minHeight: "100vh",

  backgroundColor: "#F6F6F5",

  paddingBottom: theme.spacing(4),
}));

const DemoTopBar = styled(Box)(({ theme }) => ({
  display: "flex",

  alignItems: "center",

  justifyContent: "space-between",

  minHeight: 68,

  paddingInline: theme.spacing(3),

  borderBottom: `1px solid ${theme.palette.divider}`,

  backgroundColor: theme.palette.background.paper,
}));

const DemoBrand = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,

  fontSize: 16,

  fontWeight: 750,

  letterSpacing: "-0.02em",
}));

const ExitButton = styled(Button)(({ theme }) => ({
  minHeight: 38,

  paddingInline: theme.spacing(1.5),

  border: `1px solid ${theme.palette.divider}`,

  borderRadius: 999,

  backgroundColor: theme.palette.background.paper,

  color: theme.palette.text.primary,

  textTransform: "none",

  fontSize: 12,

  fontWeight: 650,

  "&:hover": {
    backgroundColor: "#F7F7F7",
  },
}));

const DemoFrame = styled(Box)(({ theme }) => ({
  overflow: "hidden",

  width: "calc(100% - 48px)",

  maxWidth: 1380,

  minHeight: "calc(100vh - 116px)",

  marginInline: "auto",

  marginTop: theme.spacing(3),

  border: `1px solid ${theme.palette.divider}`,

  borderRadius: 22,

  backgroundColor: theme.palette.background.paper,

  boxShadow: "0 28px 70px rgba(30, 24, 18, 0.08)",

  [theme.breakpoints.down("sm")]: {
    width: "calc(100% - 24px)",
  },
}));

const FrameHeader = styled(Box)(({ theme }) => ({
  display: "grid",

  gridTemplateColumns: "1fr auto 1fr",

  alignItems: "center",

  minHeight: 68,

  paddingInline: theme.spacing(2.5),

  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const MeetingHeading = styled(Box)({
  textAlign: "center",
});

const MeetingTitle = styled(Typography)({
  fontSize: 13,

  fontWeight: 760,
});

const MeetingSubtitle = styled(Typography)(({ theme }) => ({
  marginTop: 2,

  color: theme.palette.text.secondary,

  fontSize: 10,
}));

const LiveBadge = styled(Box)({
  justifySelf: "end",

  display: "inline-flex",

  alignItems: "center",

  gap: 5,

  padding: "6px 9px",

  border: "1px solid #E6E1DA",

  borderRadius: 999,

  fontSize: 10,

  fontWeight: 760,
});

const DemoBody = styled(Box)(({ theme }) => ({
  display: "grid",

  gridTemplateColumns: "minmax(0, 1.08fr) minmax(360px, 0.92fr)",

  minHeight: 620,

  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "1fr",
  },
}));

const Panel = styled(Box)(({ theme }) => ({
  minWidth: 0,

  padding: theme.spacing(3),
}));

const LeftPanel = styled(Panel)(({ theme }) => ({
  borderRight: `1px solid ${theme.palette.divider}`,

  [theme.breakpoints.down("md")]: {
    borderRight: 0,

    borderBottom: `1px solid ${theme.palette.divider}`,
  },
}));

const RightPanel = styled(Panel)({});

const PanelHeader = styled(Box)(({ theme }) => ({
  display: "flex",

  alignItems: "center",

  justifyContent: "space-between",

  gap: theme.spacing(2),

  marginBottom: theme.spacing(2.5),
}));

const PanelTitle = styled(Typography)({
  fontSize: 11,

  fontWeight: 800,

  letterSpacing: "0.06em",
});

const Listening = styled(Box)({
  display: "inline-flex",

  alignItems: "center",

  gap: 6,

  color: BRAND_DARK,

  fontSize: 11,

  fontWeight: 680,
});

const Participants = styled(Box)(({ theme }) => ({
  display: "flex",

  flexWrap: "wrap",

  gap: theme.spacing(1),

  marginBottom: theme.spacing(2.5),
}));

const Participant = styled(Box)(({ theme }) => ({
  display: "inline-flex",

  alignItems: "center",

  gap: theme.spacing(0.8),

  minHeight: 34,

  padding: "5px 9px 5px 5px",

  border: `1px solid ${theme.palette.divider}`,

  borderRadius: 999,

  backgroundColor: "#FAFAFA",
}));

const SmallAvatar = styled(Avatar)({
  width: 24,

  height: 24,

  fontSize: 9,

  fontWeight: 700,
});

const ParticipantName = styled(Typography)({
  fontSize: 11,

  fontWeight: 700,
});

const TranscriptList = styled(Box)(({ theme }) => ({
  display: "grid",

  gap: theme.spacing(1.25),

  maxHeight: 440,

  overflowY: "auto",

  paddingRight: 4,
}));

const TranscriptRow = styled(Box)(({ theme }) => ({
  display: "grid",

  gridTemplateColumns: "38px minmax(0, 1fr)",

  gap: theme.spacing(1.15),

  alignItems: "start",

  padding: theme.spacing(1.4),

  borderRadius: 14,

  backgroundColor: "#FAFAFA",
}));

const TranscriptAvatar = styled(Avatar)({
  width: 34,

  height: 34,

  fontSize: 10,

  fontWeight: 700,
});

const SpeakerName = styled(Typography)({
  marginBottom: 2,

  fontSize: 11,

  fontWeight: 760,
});

const TranscriptText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,

  fontSize: 13,

  lineHeight: 1.55,
}));

const EmptyState = styled(Box)(({ theme }) => ({
  display: "grid",

  minHeight: 250,

  placeItems: "center",

  padding: theme.spacing(3),

  border: `1px dashed ${theme.palette.divider}`,

  borderRadius: 16,

  color: theme.palette.text.secondary,

  textAlign: "center",
}));

const EmptyTitle = styled(Typography)({
  fontSize: 14,

  fontWeight: 720,
});

const ListeningFooter = styled(Box)(({ theme }) => ({
  display: "flex",

  alignItems: "center",

  gap: theme.spacing(1),

  marginTop: theme.spacing(2),

  padding: theme.spacing(1.5),

  borderRadius: 14,

  backgroundColor: BRAND_SOFT,
}));

const ListeningFooterIcon = styled(Box)({
  display: "grid",

  width: 32,

  height: 32,

  placeItems: "center",

  flexShrink: 0,

  borderRadius: 10,

  backgroundColor: "#FFFFFF",

  color: BRAND_DARK,
});

const ListeningFooterTitle = styled(Typography)({
  fontSize: 12,

  fontWeight: 750,
});

const ListeningFooterText = styled(Typography)(({ theme }) => ({
  marginTop: 1,

  color: theme.palette.text.secondary,

  fontSize: 10,
}));

const IntelligenceStack = styled(Box)(({ theme }) => ({
  display: "grid",

  gap: theme.spacing(1.5),
}));

const IntelligenceCard = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),

  border: `1px solid ${theme.palette.divider}`,

  borderRadius: 16,

  backgroundColor: "#FFFFFF",
}));

const HighlightCard = styled(IntelligenceCard)({
  borderColor: "#E8D9C5",

  backgroundColor: "#FFFCF8",
});

const ResolvedCard = styled(IntelligenceCard)({
  borderColor: "#D8EADF",

  backgroundColor: "#FBFEFC",
});

const CardEyebrow = styled(Typography)({
  marginBottom: 7,

  color: BRAND_DARK,

  fontSize: 9,

  fontWeight: 820,

  letterSpacing: "0.08em",

  textTransform: "uppercase",
});

const CardTitle = styled(Typography)({
  fontSize: 14,

  fontWeight: 740,

  lineHeight: 1.45,
});

const CardMeta = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.8),

  color: theme.palette.text.secondary,

  fontSize: 11,

  lineHeight: 1.55,
}));

const ResolvedTitle = styled(Box)({
  display: "flex",

  alignItems: "center",

  gap: 6,

  fontSize: 14,

  fontWeight: 740,
});

const JiraStatus = styled(Box)(({ theme }) => ({
  display: "flex",

  alignItems: "center",

  justifyContent: "space-between",

  gap: theme.spacing(1),

  marginTop: theme.spacing(1.25),

  paddingTop: theme.spacing(1.25),

  borderTop: `1px solid ${theme.palette.divider}`,
}));

const JiraLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,

  fontSize: 10,

  fontWeight: 650,
}));

const JiraAnchor = styled("a")({
  display: "inline-flex",

  alignItems: "center",

  gap: 5,

  color: BRAND_DARK,

  fontSize: 12,

  fontWeight: 760,

  textDecoration: "none",

  "&:hover": {
    textDecoration: "underline",
  },
});

const JiraPending = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,

  fontSize: 11,

  fontWeight: 650,
}));

const Controls = styled(Box)(({ theme }) => ({
  display: "flex",

  alignItems: "center",

  justifyContent: "center",

  gap: theme.spacing(1),

  padding: theme.spacing(2),

  borderTop: `1px solid ${theme.palette.divider}`,
}));

const StartButton = styled(Button)({
  minHeight: 42,

  paddingInline: 18,

  borderRadius: 999,

  backgroundColor: "#161616",

  color: "#FFFFFF",

  textTransform: "none",

  fontWeight: 700,

  "&:hover": {
    backgroundColor: "#2B2B2B",
  },
});

const EndButton = styled(Button)({
  minHeight: 42,

  paddingInline: 18,

  borderRadius: 999,

  backgroundColor: "#B64545",

  color: "#FFFFFF",

  textTransform: "none",

  fontWeight: 700,

  "&:hover": {
    backgroundColor: "#9E3737",
  },
});

const EmptyDescription = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.75),

  color: theme.palette.text.secondary,

  fontSize: 13,

  lineHeight: 1.5,
}));

function speakerDetails(participantId: string): {
  name: string;
  initials: string;
} {
  if (participantId === "demo:alex") {
    return {
      name: "Alex",
      initials: "AL",
    };
  }

  if (participantId === "demo:maya") {
    return {
      name: "Maya",
      initials: "MA",
    };
  }

  if (participantId.startsWith("member:")) {
    return {
      name: "You",
      initials: "YO",
    };
  }

  return {
    name: "Participant",
    initials: "P",
  };
}

function displayOwner(owner?: string | null): string {
  if (!owner) {
    return "Not set";
  }

  if (owner === "demo:alex") {
    return "Alex";
  }

  if (owner === "demo:maya") {
    return "Maya";
  }

  if (owner.startsWith("member:")) {
    return "You";
  }

  return owner;
}

function jiraStateLabel(
  status: "not_synced" | "pending" | "processing" | "synced" | "error",
): string {
  switch (status) {
    case "pending":
      return "Queued";

    case "processing":
      return "Creating…";

    case "synced":
      return "Synced";

    case "error":
      return "Sync error";

    default:
      return "Waiting";
  }
}

export function DemoMeetingView() {
  const router = useRouter();

  const { status, meetingId, error, startMeeting, stopMeeting } =
    useMeetingRoom();

  const { snapshot, error: snapshotError } = useMeetingSnapshot(meetingId);

  const connected = status === "connected";

  const connecting = status === "connecting";

  const disconnecting = status === "disconnecting";

  const {
    activeActor,

    status: demoParticipantsStatus,

    error: demoParticipantsError,

    startDemoParticipants,

    stopDemoParticipants,
  } = useDemoParticipants({
    meetingId,

    meetingConnected: connected,
  });

  useEffect(() => {
    if (!connected || !meetingId || demoParticipantsStatus !== "idle") {
      return;
    }

    void startDemoParticipants();
  }, [connected, meetingId, demoParticipantsStatus, startDemoParticipants]);

  const { data: dashboard } = useGetDashboardOverviewQuery(undefined, {
    skip: !meetingId,

    pollingInterval: connected ? 1000 : 0,
  });

  const { data: jiraSetup } = useGetJiraSetupQuery(undefined, {
    skip: !meetingId,

    pollingInterval: connected ? 2000 : 0,
  });

  const transcript = snapshot?.transcript ?? [];

  const currentCommitment =
    snapshot && snapshot.commitments.length > 0
      ? snapshot.commitments[snapshot.commitments.length - 1]
      : null;

  const meetingInterventions = useMemo(() => {
    if (!dashboard || !meetingId) {
      return [];
    }

    return dashboard.recentInterventions.filter(
      (intervention) => intervention.meetingId === meetingId,
    );
  }, [dashboard, meetingId]);

  const unresolvedIntervention =
    meetingInterventions.find((intervention) => !intervention.resolved) ?? null;

  const resolvedIntervention =
    meetingInterventions.find((intervention) => intervention.resolved) ?? null;

  const relatedSprintItemId =
    unresolvedIntervention?.sprintItemId ??
    resolvedIntervention?.sprintItemId ??
    null;

  const executionItem = useMemo(() => {
    if (!dashboard) {
      return null;
    }

    if (relatedSprintItemId) {
      const byId = dashboard.executionItems.find(
        (item) => item.id === relatedSprintItemId,
      );

      if (byId) {
        return byId;
      }
    }

    if (currentCommitment) {
      const byTitle = dashboard.executionItems.find(
        (item) => item.title.trim() === currentCommitment.summary.trim(),
      );

      if (byTitle) {
        return byTitle;
      }
    }

    return null;
  }, [dashboard, relatedSprintItemId, currentCommitment]);

  const jiraBaseUrl = jiraSetup?.site?.url
    ? jiraSetup.site.url.replace(/\/$/, "")
    : null;

  const jiraUrl =
    jiraBaseUrl && executionItem?.jira.issueKey
      ? `${jiraBaseUrl}/browse/${encodeURIComponent(
          executionItem.jira.issueKey,
        )}`
      : null;

  const handleStopDemo = async () => {
    await stopDemoParticipants();

    await stopMeeting();
  };

  const handleExitDemo = async () => {
    if (meetingId) {
      await handleStopDemo();
    }

    router.push(ROUTES.app.dashboard);
  };

  const showEndButton =
    connected || disconnecting || (status === "error" && meetingId !== null);

  const busy = connecting || disconnecting;

  const combinedError = error ?? snapshotError ?? demoParticipantsError;

  return (
    <PageRoot>
      <DemoTopBar>
        <DemoBrand>Lumos live demo</DemoBrand>

        <ExitButton
          type="button"
          startIcon={<ArrowBackRounded />}
          onClick={() => void handleExitDemo()}
        >
          Exit demo
        </ExitButton>
      </DemoTopBar>

      <DemoFrame>
        <FrameHeader>
          <Box />

          <MeetingHeading>
            <MeetingTitle>Product planning</MeetingTitle>

            <MeetingSubtitle>Real-time meeting intelligence</MeetingSubtitle>
          </MeetingHeading>

          <LiveBadge>
            <FiberManualRecordRounded
              fontSize="inherit"
              htmlColor={connected ? BRAND : "#BBBBBB"}
            />

            {connected ? "LIVE" : "READY"}
          </LiveBadge>
        </FrameHeader>

        {combinedError ? <Alert severity="error">{combinedError}</Alert> : null}

        <DemoBody>
          <LeftPanel>
            <PanelHeader>
              <PanelTitle>LIVE CONVERSATION</PanelTitle>

              <Listening>
                <MicRounded fontSize="small" />

                {connected ? "Listening" : "Waiting"}
              </Listening>
            </PanelHeader>

            <Participants>
              <Participant>
                <SmallAvatar>YO</SmallAvatar>

                <ParticipantName>You</ParticipantName>
              </Participant>

              <Participant>
                <SmallAvatar>AL</SmallAvatar>

                <ParticipantName>
                  Alex
                  {activeActor === "alex" ? " · Speaking" : ""}
                </ParticipantName>
              </Participant>

              <Participant>
                <SmallAvatar>MA</SmallAvatar>

                <ParticipantName>
                  Maya
                  {activeActor === "maya" ? " · Speaking" : ""}
                </ParticipantName>
              </Participant>
            </Participants>

            {transcript.length === 0 ? (
              <EmptyState>
                <Box>
                  <EmptyTitle>
                    {!connected
                      ? "Start the demo when you're ready"
                      : "Lumos is listening to the meeting"}
                  </EmptyTitle>

                  <EmptyDescription>
                    Speaker-aware transcript will appear here in real time.
                  </EmptyDescription>
                </Box>
              </EmptyState>
            ) : (
              <TranscriptList>
                {transcript.map((turn) => {
                  const speaker = speakerDetails(turn.participantId);

                  return (
                    <TranscriptRow key={turn.id}>
                      <TranscriptAvatar>{speaker.initials}</TranscriptAvatar>

                      <Box>
                        <SpeakerName>{speaker.name}</SpeakerName>

                        <TranscriptText>{turn.text}</TranscriptText>
                      </Box>
                    </TranscriptRow>
                  );
                })}
              </TranscriptList>
            )}

            {connected ? (
              <ListeningFooter>
                <ListeningFooterIcon>
                  <MicRounded fontSize="small" />
                </ListeningFooterIcon>

                <Box>
                  <ListeningFooterTitle>Listening</ListeningFooterTitle>

                  <ListeningFooterText>
                    Lumos is following the conversation in real time.
                  </ListeningFooterText>
                </Box>
              </ListeningFooter>
            ) : null}
          </LeftPanel>

          <RightPanel>
            <PanelHeader>
              <PanelTitle>LUMOS AI</PanelTitle>

              <Listening>{connected ? "Listening" : "Ready"}</Listening>
            </PanelHeader>

            <IntelligenceStack>
              {unresolvedIntervention ? (
                <HighlightCard>
                  <CardEyebrow>Needs clarification</CardEyebrow>

                  <CardTitle>{unresolvedIntervention.message}</CardTitle>

                  <CardMeta>
                    Lumos is listening to the conversation for the missing
                    context.
                  </CardMeta>
                </HighlightCard>
              ) : null}

              {!unresolvedIntervention && resolvedIntervention ? (
                <ResolvedCard>
                  <CardEyebrow>Resolved</CardEyebrow>

                  <ResolvedTitle>
                    <CheckCircleRounded fontSize="small" />
                    Context resolved
                  </ResolvedTitle>

                  <CardMeta>
                    The missing context was captured from the conversation.
                  </CardMeta>
                </ResolvedCard>
              ) : null}

              {currentCommitment ? (
                <IntelligenceCard>
                  <CardEyebrow>Commitment</CardEyebrow>

                  <CardTitle>{currentCommitment.summary}</CardTitle>

                  <CardMeta>
                    Owner: {displayOwner(currentCommitment.owner)}
                    <br />
                    Due: {currentCommitment.dueText || "Not set"}
                  </CardMeta>
                </IntelligenceCard>
              ) : null}

              {executionItem ? (
                <ResolvedCard>
                  <CardEyebrow>Execution</CardEyebrow>

                  <CardTitle>{executionItem.title}</CardTitle>

                  <CardMeta>
                    Status: {executionItem.status}
                    <br />
                    Due:{" "}
                    {executionItem.dueAt
                      ? new Date(executionItem.dueAt).toLocaleDateString()
                      : "Not set"}
                  </CardMeta>

                  <JiraStatus>
                    <JiraLabel>JIRA</JiraLabel>

                    {jiraUrl && executionItem.jira.issueKey ? (
                      <JiraAnchor
                        href={jiraUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {executionItem.jira.issueKey}

                        <LaunchRounded fontSize="inherit" />
                      </JiraAnchor>
                    ) : (
                      <JiraPending>
                        {jiraStateLabel(executionItem.jira.status)}
                      </JiraPending>
                    )}
                  </JiraStatus>

                  {executionItem.jira.lastError ? (
                    <CardMeta>{executionItem.jira.lastError}</CardMeta>
                  ) : null}
                </ResolvedCard>
              ) : null}

              {!unresolvedIntervention &&
              !resolvedIntervention &&
              !currentCommitment &&
              !executionItem ? (
                <EmptyState>
                  <Typography variant="body2" color="text.secondary">
                    Lumos intelligence will appear here as the meeting develops.
                  </Typography>
                </EmptyState>
              ) : null}
            </IntelligenceStack>
          </RightPanel>
        </DemoBody>

        <Controls>
          {showEndButton ? (
            <EndButton
              type="button"
              startIcon={<StopRounded />}
              disabled={disconnecting}
              onClick={() => void handleStopDemo()}
            >
              {disconnecting ? "Ending..." : "End demo"}
            </EndButton>
          ) : (
            <StartButton
              type="button"
              startIcon={<MicRounded />}
              disabled={busy}
              onClick={() => void startMeeting()}
            >
              {connecting ? "Starting demo..." : "Start live demo"}
            </StartButton>
          )}
        </Controls>
      </DemoFrame>
    </PageRoot>
  );
}
