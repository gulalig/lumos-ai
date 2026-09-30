"use client";

import {
  ArrowBackRounded,
  AssignmentTurnedInOutlined,
  BoltRounded,
  CalendarTodayOutlined,
  CheckCircleOutlineRounded,
  HelpOutlineRounded,
  LightbulbOutlined,
  PersonOutlineRounded,
  QuestionAnswerOutlined,
  ScheduleRounded,
  WarningAmberRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

import { ROUTES } from "@/constants/routes";
import type { MeetingSnapshotItem } from "@/features/meetings/meetings.types";
import { useGetMeetingDetailQuery } from "@/store/api/meetings.api";

const ACCENT_DARK = "#A9793C";
const ACCENT_SOFT = "#F7F0E6";

const PageRoot = styled(Box)(({ theme }) => ({
  width: "100%",
  maxWidth: 1500,
  marginInline: "auto",
  padding: theme.spacing(4.5, 5),

  [theme.breakpoints.down("md")]: {
    padding: theme.spacing(3),
  },

  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(2),
  },
}));

const BackLink = styled(Link)(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing(0.5),
  marginBottom: theme.spacing(2),
  color: theme.palette.text.secondary,
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",

  "&:hover": {
    color: theme.palette.text.primary,
  },
}));

const Header = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: theme.spacing(3),
  marginBottom: theme.spacing(3),

  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
  },
}));

const HeaderCopy = styled(Box)({
  minWidth: 0,
});

const PageTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 750,
  letterSpacing: "-0.04em",
}));

const MeetingId = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.6),
  color: theme.palette.text.secondary,
  fontSize: 12,
}));

const StatusBadge = styled(Box)({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 32,
  paddingInline: 12,
  borderRadius: 999,
  color: "#24724A",
  backgroundColor: "#EAF7EF",
  fontSize: 12,
  fontWeight: 650,
  textTransform: "capitalize",
});

const MetaGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: theme.spacing(2),
  marginBottom: theme.spacing(3),

  [theme.breakpoints.down("lg")]: {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },

  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
  },
}));

const MetaCard = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
  padding: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 15,
  backgroundColor: theme.palette.background.paper,
}));

const MetaIcon = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 38,
  height: 38,
  flexShrink: 0,
  borderRadius: 11,
  color: ACCENT_DARK,
  backgroundColor: ACCENT_SOFT,
});

const MetaValue = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 700,
}));

const MetaLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: 11,
}));

const MainGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.6fr) minmax(330px, 0.75fr)",
  gap: theme.spacing(3),
  alignItems: "start",

  [theme.breakpoints.down("lg")]: {
    gridTemplateColumns: "1fr",
  },
}));

const Column = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(3),
}));

const Panel = styled(Box)(({ theme }) => ({
  overflow: "hidden",
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 18,
  backgroundColor: theme.palette.background.paper,
}));

const PanelHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2.5),
}));

const PanelTitleRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
}));

const PanelIcon = styled(Box)({
  display: "flex",
  color: ACCENT_DARK,
});

const PanelTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 700,
}));

const PanelDescription = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.5),
  color: theme.palette.text.secondary,
}));

const DividerLine = styled(Box)(({ theme }) => ({
  height: 1,
  backgroundColor: theme.palette.divider,
}));

const OutcomeList = styled(Box)({
  display: "grid",
});

const OutcomeCard = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2.25, 2.5),
  borderTop: `1px solid ${theme.palette.divider}`,

  "&:hover": {
    backgroundColor: "#FCFCFD",
  },
}));

const OutcomeTop = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: theme.spacing(2),
}));

const OutcomeSummary = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 650,
  lineHeight: 1.5,
}));

const Confidence = styled(Box)({
  flexShrink: 0,
  minHeight: 25,
  paddingInline: 8,
  borderRadius: 999,
  color: "#60636B",
  backgroundColor: "#F1F1F3",
  fontSize: 11,
  fontWeight: 650,
  lineHeight: "25px",
});

const Evidence = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(1.4),
  padding: theme.spacing(1.4, 1.5),
  borderLeft: `3px solid ${ACCENT_DARK}`,
  borderRadius: 8,
  color: theme.palette.text.secondary,
  backgroundColor: "#FAFAFB",
}));

const OutcomeMeta = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  marginTop: theme.spacing(1.4),
}));

const MetaPill = styled(Box)(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing(0.5),
  minHeight: 27,
  paddingInline: theme.spacing(1),
  borderRadius: 999,
  color: theme.palette.text.secondary,
  backgroundColor: "#F3F3F5",
  fontSize: 11,
  fontWeight: 600,
}));

const WarningPill = styled(MetaPill)({
  color: "#8A5B16",
  backgroundColor: "#FFF3DC",
});

const InterventionRow = styled(Box)(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(1.4),
  padding: theme.spacing(2),
  borderTop: `1px solid ${theme.palette.divider}`,
}));

const InterventionIcon = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 34,
  height: 34,
  flexShrink: 0,
  borderRadius: 10,
  color: ACCENT_DARK,
  backgroundColor: ACCENT_SOFT,
});

const InterventionCopy = styled(Box)({
  minWidth: 0,
});

const InterventionTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 650,
}));

const InterventionText = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.35),
  color: theme.palette.text.secondary,
  lineHeight: 1.5,
}));

const ResolvedBadge = styled(Box)({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  marginTop: 8,
  minHeight: 25,
  paddingInline: 8,
  borderRadius: 999,
  color: "#24724A",
  backgroundColor: "#EAF7EF",
  fontSize: 11,
  fontWeight: 650,
});

const OpenBadge = styled(ResolvedBadge)({
  color: "#8A5B16",
  backgroundColor: "#FFF3DC",
});

const EmptyState = styled(Box)(({ theme }) => ({
  padding: theme.spacing(4),
  textAlign: "center",
  color: theme.palette.text.secondary,
}));

const LoadingState = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 520,
});

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function duration(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt) {
    return "—";
  }

  const start = new Date(startedAt);

  const end = endedAt ? new Date(endedAt) : new Date();

  const minutes = Math.max(
    0,
    Math.floor((end.getTime() - start.getTime()) / 60000),
  );

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);

  const rest = minutes % 60;

  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

interface OutcomeSectionProps {
  title: string;
  description: string;
  items: MeetingSnapshotItem[];
  icon: "commitment" | "decision" | "question" | "proposal";
}

function OutcomeSection({
  title,
  description,
  items,
  icon,
}: OutcomeSectionProps) {
  const iconNode =
    icon === "commitment" ? (
      <AssignmentTurnedInOutlined fontSize="small" />
    ) : icon === "decision" ? (
      <CheckCircleOutlineRounded fontSize="small" />
    ) : icon === "question" ? (
      <HelpOutlineRounded fontSize="small" />
    ) : (
      <LightbulbOutlined fontSize="small" />
    );

  return (
    <Panel>
      <PanelHeader>
        <PanelTitleRow>
          <PanelIcon>{iconNode}</PanelIcon>

          <PanelTitle variant="h6">{title}</PanelTitle>
        </PanelTitleRow>

        <PanelDescription variant="body2">{description}</PanelDescription>
      </PanelHeader>

      {items.length === 0 ? (
        <>
          <DividerLine />

          <EmptyState>
            No {title.toLowerCase()} captured in this meeting.
          </EmptyState>
        </>
      ) : (
        <OutcomeList>
          {items.map((item) => (
            <OutcomeCard key={item.id}>
              <OutcomeTop>
                <OutcomeSummary variant="body2">{item.summary}</OutcomeSummary>

                <Confidence>{Math.round(item.confidence * 100)}%</Confidence>
              </OutcomeTop>

              <Evidence>
                <Typography variant="body2">“{item.evidenceText}”</Typography>
              </Evidence>

              <OutcomeMeta>
                {item.owner ? (
                  <MetaPill>
                    <PersonOutlineRounded fontSize="inherit" />
                    {item.owner}
                  </MetaPill>
                ) : item.kind === "commitment" ? (
                  <WarningPill>
                    <WarningAmberRounded fontSize="inherit" />
                    Missing owner
                  </WarningPill>
                ) : null}

                {item.dueText ? (
                  <MetaPill>
                    <CalendarTodayOutlined fontSize="inherit" />
                    {item.dueText}
                  </MetaPill>
                ) : item.kind === "commitment" ? (
                  <WarningPill>
                    <WarningAmberRounded fontSize="inherit" />
                    Missing due date
                  </WarningPill>
                ) : null}

                <MetaPill>{item.explicit ? "Explicit" : "Inferred"}</MetaPill>
              </OutcomeMeta>
            </OutcomeCard>
          ))}
        </OutcomeList>
      )}
    </Panel>
  );
}

export function MeetingDetailView() {
  const router = useRouter();
  const params = useParams<{
    meetingId: string;
  }>();

  const meetingId = params.meetingId;

  const { data, isLoading, error, refetch } =
    useGetMeetingDetailQuery(meetingId);

  const missingMeeting = !!error && "status" in error && error.status === 404;

  useEffect(() => {
    if (missingMeeting) {
      router.replace(ROUTES.app.meetings);
    }
  }, [missingMeeting, router]);

  if (isLoading || missingMeeting) {
    return (
      <LoadingState>
        <CircularProgress size={30} />
      </LoadingState>
    );
  }

  if (error || !data) {
    return (
      <PageRoot>
        <Alert
          severity="error"
          action={
            <Button
              type="button"
              color="inherit"
              onClick={() => {
                void refetch();
              }}
            >
              Retry
            </Button>
          }
        >
          Unable to load meeting details.
        </Alert>
      </PageRoot>
    );
  }

  const totalOutcomes =
    data.snapshot.decisions.length +
    data.snapshot.commitments.length +
    data.snapshot.proposals.length +
    data.snapshot.questions.length;

  const resolvedCount = data.interventions.filter(
    (item) => item.resolved,
  ).length;

  return (
    <PageRoot>
      <BackLink href={ROUTES.app.meetings}>
        <ArrowBackRounded fontSize="small" />
        Back to meetings
      </BackLink>

      <Header>
        <HeaderCopy>
          <PageTitle variant="h3">{data.meeting.roomName}</PageTitle>

          <MeetingId>Meeting ID: {data.meeting.id}</MeetingId>
        </HeaderCopy>

        <StatusBadge>
          {data.meeting.status === "active" ? (
            <BoltRounded fontSize="small" />
          ) : (
            <CheckCircleOutlineRounded fontSize="small" />
          )}

          {data.meeting.status}
        </StatusBadge>
      </Header>

      <MetaGrid>
        <MetaCard>
          <MetaIcon>
            <CalendarTodayOutlined />
          </MetaIcon>

          <Box>
            <MetaValue variant="body2">
              {formatDate(data.meeting.startedAt ?? data.meeting.createdAt)}
            </MetaValue>

            <MetaLabel>Date</MetaLabel>
          </Box>
        </MetaCard>

        <MetaCard>
          <MetaIcon>
            <ScheduleRounded />
          </MetaIcon>

          <Box>
            <MetaValue variant="body2">
              {duration(data.meeting.startedAt, data.meeting.endedAt)}
            </MetaValue>

            <MetaLabel>Duration</MetaLabel>
          </Box>
        </MetaCard>

        <MetaCard>
          <MetaIcon>
            <QuestionAnswerOutlined />
          </MetaIcon>

          <Box>
            <MetaValue variant="body2">{totalOutcomes}</MetaValue>

            <MetaLabel>Captured outcomes</MetaLabel>
          </Box>
        </MetaCard>

        <MetaCard>
          <MetaIcon>
            <BoltRounded />
          </MetaIcon>

          <Box>
            <MetaValue variant="body2">
              {resolvedCount} / {data.interventions.length}
            </MetaValue>

            <MetaLabel>Interventions resolved</MetaLabel>
          </Box>
        </MetaCard>
      </MetaGrid>

      <MainGrid>
        <Column>
          <OutcomeSection
            title="Commitments"
            description="Actions and ownership Lumos extracted from the conversation."
            items={data.snapshot.commitments}
            icon="commitment"
          />

          <OutcomeSection
            title="Decisions"
            description="Decisions explicitly made or confidently identified during the meeting."
            items={data.snapshot.decisions}
            icon="decision"
          />

          <OutcomeSection
            title="Questions"
            description="Open questions captured from the meeting."
            items={data.snapshot.questions}
            icon="question"
          />

          <OutcomeSection
            title="Proposals"
            description="Ideas and proposals discussed but not yet finalized."
            items={data.snapshot.proposals}
            icon="proposal"
          />
        </Column>

        <Column>
          <Panel>
            <PanelHeader>
              <PanelTitleRow>
                <PanelIcon>
                  <BoltRounded fontSize="small" />
                </PanelIcon>

                <PanelTitle variant="h6">Lumos interventions</PanelTitle>
              </PanelTitleRow>

              <PanelDescription variant="body2">
                Clarifications Lumos requested when execution context was
                incomplete.
              </PanelDescription>
            </PanelHeader>

            {data.interventions.length === 0 ? (
              <>
                <DividerLine />

                <EmptyState>
                  No interventions were needed during this meeting.
                </EmptyState>
              </>
            ) : (
              data.interventions.map((intervention) => (
                <InterventionRow key={intervention.id}>
                  <InterventionIcon>
                    <BoltRounded fontSize="small" />
                  </InterventionIcon>

                  <InterventionCopy>
                    <InterventionTitle variant="body2">
                      {intervention.reason === "missing_owner"
                        ? "Missing owner"
                        : "Missing due date"}
                    </InterventionTitle>

                    <InterventionText variant="body2">
                      {intervention.message}
                    </InterventionText>

                    {intervention.resolved ? (
                      <ResolvedBadge>
                        <CheckCircleOutlineRounded fontSize="inherit" />
                        Resolved
                      </ResolvedBadge>
                    ) : (
                      <OpenBadge>
                        <WarningAmberRounded fontSize="inherit" />
                        Still open
                      </OpenBadge>
                    )}
                  </InterventionCopy>
                </InterventionRow>
              ))
            )}
          </Panel>
        </Column>
      </MainGrid>
    </PageRoot>
  );
}
