"use client";

import {
  ArrowForwardRounded,
  AssignmentTurnedInOutlined,
  BoltRounded,
  CheckCircleOutlineRounded,
  ErrorOutlineRounded,
  EventOutlined,
  GroupsOutlined,
  LaunchRounded,
  LinkOutlined,
  PendingActionsOutlined,
  SyncRounded,
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
import { AppPage } from "@/components/layout/AppPage";
import { useGetJiraSetupQuery } from "@/store/api/jira.api";

import { ROUTES } from "@/constants/routes";
import type {
  DashboardExecutionItem,
  DashboardIntervention,
  DashboardJiraStatus,
  DashboardMeeting,
} from "@/features/dashboard/dashboard.types";
import { useGetDashboardOverviewQuery } from "@/store/api/dashboard.api";
import { useAppSelector } from "@/store/hooks";

const ACCENT_DARK = "#A9793C";
const ACCENT_SOFT = "#F7F0E6";

const DashboardRoot = styled(AppPage)({});

const Hero = styled(Box)(({ theme }) => ({
  position: "relative",
  overflow: "hidden",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: theme.spacing(4),
  minHeight: 180,
  marginBottom: theme.spacing(3),
  padding: theme.spacing(4),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 22,
  backgroundColor: theme.palette.background.paper,

  [theme.breakpoints.down("md")]: {
    alignItems: "flex-start",
    flexDirection: "column",
    minHeight: 0,
    padding: theme.spacing(3),
  },
}));

const HeroContent = styled(Box)({
  position: "relative",
  zIndex: 1,
  maxWidth: 760,
});

const PageTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 750,
  letterSpacing: "-0.045em",

  [theme.breakpoints.down("sm")]: {
    fontSize: "2rem",
  },
}));

const PageDescription = styled(Typography)(({ theme }) => ({
  maxWidth: 650,
  marginTop: theme.spacing(1.25),
  color: theme.palette.text.secondary,
  fontSize: 16,
  lineHeight: 1.7,
}));

const HeroStatus = styled(Box)(({ theme }) => ({
  position: "relative",
  zIndex: 1,
  display: "grid",
  gap: theme.spacing(1),
  minWidth: 230,

  [theme.breakpoints.down("md")]: {
    width: "100%",
    minWidth: 0,
  },
}));

const StatusCard = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.25),
  minHeight: 52,
  padding: theme.spacing(1, 1.5),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 14,
  backgroundColor: "rgba(255, 255, 255, 0.82)",
}));

const StatusIcon = styled(Box)({
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

const StatusCopy = styled(Box)({
  minWidth: 0,
});

const StatusLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: 11,
  lineHeight: 1.2,
}));

const StatusValue = styled(Typography)(({ theme }) => ({
  overflow: "hidden",
  marginTop: 2,
  color: theme.palette.text.primary,
  fontWeight: 650,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}));

const SummaryGrid = styled(Box)(({ theme }) => ({
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

interface SummaryCardProps {
  emphasized?: boolean;
}

const SummaryCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== "emphasized",
})<SummaryCardProps>(({ theme, emphasized }) => ({
  position: "relative",
  overflow: "hidden",
  minHeight: 148,
  padding: theme.spacing(2.5),
  border: `1px solid ${
    emphasized ? "rgba(200, 155, 91, 0.35)" : theme.palette.divider
  }`,
  borderRadius: 18,
  backgroundColor: emphasized ? "#FFFDF9" : theme.palette.background.paper,
  transition: theme.transitions.create(
    ["transform", "box-shadow", "border-color"],
    {
      duration: theme.transitions.duration.shortest,
    },
  ),

  "&:hover": {
    transform: "translateY(-2px)",
    borderColor: emphasized ? "rgba(200, 155, 91, 0.5)" : "#DADAE0",
    boxShadow: "0 10px 30px rgba(24, 24, 27, 0.05)",
  },
}));

const SummaryHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(2),
}));

const SummaryLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontWeight: 500,
}));

const SummaryIcon = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 40,
  height: 40,
  flexShrink: 0,
  borderRadius: 12,
  color: ACCENT_DARK,
  backgroundColor: ACCENT_SOFT,
});

const SummaryValue = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(2),
  color: theme.palette.text.primary,
  fontWeight: 750,
  fontSize: 32,
  letterSpacing: "-0.04em",
  lineHeight: 1,
}));

const SummaryHint = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(1),
  color: theme.palette.text.secondary,
  fontSize: 12,
}));

const MainGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.65fr) minmax(330px, 0.85fr)",
  alignItems: "start",
  gap: theme.spacing(3),

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

const FeaturedPanel = styled(Panel)(({ theme }) => ({
  borderColor: "#DEDEE3",
  boxShadow: "0 4px 18px rgba(24, 24, 27, 0.025)",

  [theme.breakpoints.up("lg")]: {
    minHeight: 365,
  },
}));

const PanelHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: theme.spacing(2),
  padding: theme.spacing(2.5, 2.75),
}));

const PanelTitleGroup = styled(Box)({
  minWidth: 0,
});

const PanelTitleRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
}));

const PanelTitleIcon = styled(Box)({
  display: "flex",
  color: ACCENT_DARK,
});

const PanelTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 700,
  letterSpacing: "-0.015em",
}));

const PanelDescription = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.55),
  color: theme.palette.text.secondary,
  lineHeight: 1.5,
}));

const ViewAllLink = styled(Link)(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing(0.5),
  flexShrink: 0,
  paddingTop: 3,
  color: ACCENT_DARK,
  fontSize: theme.typography.body2.fontSize,
  fontWeight: 650,
  textDecoration: "none",

  "&:hover": {
    color: "#8F642E",
  },
}));

const DividerLine = styled(Box)(({ theme }) => ({
  height: 1,
  backgroundColor: theme.palette.divider,
}));

const ExecutionList = styled(Box)({
  display: "grid",
});

const ExecutionHeader = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 120px 130px 110px",
  gap: theme.spacing(2),
  padding: theme.spacing(1.15, 2.75),
  color: theme.palette.text.secondary,
  fontSize: 11,
  fontWeight: 650,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  backgroundColor: "#FAFAFB",

  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}));

const ExecutionRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 120px 130px 110px",
  alignItems: "center",
  gap: theme.spacing(2),
  minHeight: 86,
  padding: theme.spacing(1.75, 2.75),
  borderTop: `1px solid ${theme.palette.divider}`,

  "&:hover": {
    backgroundColor: "#FCFCFD",
  },

  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "1fr",
    gap: theme.spacing(1),
    padding: theme.spacing(2),
  },
}));

const ExecutionMain = styled(Box)({
  minWidth: 0,
});

const ExecutionTitle = styled(Typography)(({ theme }) => ({
  overflow: "hidden",
  color: theme.palette.text.primary,
  fontWeight: 650,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",

  [theme.breakpoints.down("md")]: {
    whiteSpace: "normal",
  },
}));

const ExecutionMeta = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: theme.spacing(0.6),
  marginTop: theme.spacing(0.7),
}));

interface PillProps {
  tone: "neutral" | "warning" | "success" | "error" | "accent";
}

const Pill = styled(Box, {
  shouldForwardProp: (prop) => prop !== "tone",
})<PillProps>(({ theme, tone }) => {
  const variants = {
    neutral: {
      color: "#63666F",
      backgroundColor: "#F1F1F3",
    },

    warning: {
      color: "#8A5B16",
      backgroundColor: "#FFF3DC",
    },

    success: {
      color: "#24724A",
      backgroundColor: "#EAF7EF",
    },

    error: {
      color: "#B23B3B",
      backgroundColor: "#FCECEC",
    },

    accent: {
      color: "#8D652D",
      backgroundColor: ACCENT_SOFT,
    },
  };

  return {
    display: "inline-flex",
    alignItems: "center",
    gap: theme.spacing(0.45),
    width: "fit-content",
    minHeight: 25,
    paddingInline: theme.spacing(0.9),
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 650,
    whiteSpace: "nowrap",
    ...variants[tone],
  };
});

const CellText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: 13,
}));

const JiraLink = styled("a")(({ theme }) => ({
  display: "inline-flex",

  alignItems: "center",

  gap: theme.spacing(0.5),

  width: "fit-content",

  color: ACCENT_DARK,

  fontSize: 13,

  fontWeight: 650,

  textDecoration: "none",

  "&:hover": {
    color: "#8F642E",

    textDecoration: "underline",
  },
}));

const AttentionList = styled(Box)({
  display: "grid",
});

const AttentionRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: theme.spacing(1.4),
  padding: theme.spacing(1.8, 2.25),
  borderTop: `1px solid ${theme.palette.divider}`,

  "&:hover": {
    backgroundColor: "#FCFCFD",
  },
}));

const AttentionIcon = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  flexShrink: 0,
  borderRadius: 9,
  color: "#A76E19",
  backgroundColor: "#FFF4DF",
});

const AttentionText = styled(Box)({
  minWidth: 0,
});

const AttentionTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 650,
}));

const AttentionDescription = styled(Typography)(({ theme }) => ({
  display: "block",
  marginTop: theme.spacing(0.3),
  color: theme.palette.text.secondary,
  lineHeight: 1.45,
}));

const MeetingList = styled(Box)({
  display: "grid",
});

const MeetingRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(2),
  minHeight: 70,
  padding: theme.spacing(1.5, 2.25),
  borderTop: `1px solid ${theme.palette.divider}`,

  "&:hover": {
    backgroundColor: "#FCFCFD",
  },
}));

const MeetingLeft = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.3),
  minWidth: 0,
}));

const MeetingIcon = styled(Box)({
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

const MeetingInfo = styled(Box)({
  minWidth: 0,
});

const MeetingName = styled(Typography)(({ theme }) => ({
  overflow: "hidden",
  color: theme.palette.text.primary,
  fontWeight: 650,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}));

const MeetingDate = styled(Typography)(({ theme }) => ({
  display: "block",
  marginTop: theme.spacing(0.2),
  color: theme.palette.text.secondary,
}));

const InterventionList = styled(Box)({
  display: "grid",
});

const InterventionRow = styled(Box)(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(1.4),
  padding: theme.spacing(1.8, 2.25),
  borderTop: `1px solid ${theme.palette.divider}`,

  "&:hover": {
    backgroundColor: "#FCFCFD",
  },
}));

const InterventionIcon = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  flexShrink: 0,
  borderRadius: 9,
  color: "#24724A",
  backgroundColor: "#EAF7EF",
});

const InterventionContent = styled(Box)({
  minWidth: 0,
});

const InterventionTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 650,
}));

const InterventionMeta = styled(Typography)(({ theme }) => ({
  display: "block",
  marginTop: theme.spacing(0.25),
  color: theme.palette.text.secondary,
  lineHeight: 1.45,
}));

const JiraSummary = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: theme.spacing(1),
  padding: theme.spacing(2.25),

  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
  },
}));

const JiraStat = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.4),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  backgroundColor: "#FAFAFB",
}));

const JiraStatValue = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 700,
  fontSize: 20,
  letterSpacing: "-0.03em",
}));

const JiraStatLabel = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.25),
  color: theme.palette.text.secondary,
  fontSize: 11,
}));

const EmptyState = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(2),
  minHeight: 145,
  padding: theme.spacing(2.75),

  [theme.breakpoints.down("sm")]: {
    alignItems: "flex-start",
  },
}));

const EmptyIcon = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 44,
  height: 44,
  flexShrink: 0,
  borderRadius: 13,
  color: ACCENT_DARK,
  backgroundColor: ACCENT_SOFT,
});

const EmptyCopy = styled(Box)({
  minWidth: 0,
});

const EmptyTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 650,
}));

const EmptyDescription = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.35),
  color: theme.palette.text.secondary,
  lineHeight: 1.55,
}));

const LoadingState = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 520,
});

const RefreshText = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(2),
  color: theme.palette.text.secondary,
}));

function formatDate(value: string | null): string {
  if (!value) {
    return "No date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatStatus(status: DashboardExecutionItem["status"]): string {
  switch (status) {
    case "todo":
      return "To do";

    case "in_progress":
      return "In progress";

    case "blocked":
      return "Blocked";

    case "done":
      return "Done";

    case "cancelled":
      return "Cancelled";
  }
}

function statusTone(
  status: DashboardExecutionItem["status"],
): PillProps["tone"] {
  switch (status) {
    case "done":
      return "success";

    case "blocked":
      return "error";

    case "in_progress":
      return "accent";

    case "todo":
    case "cancelled":
      return "neutral";
  }
}

function jiraTone(status: DashboardJiraStatus): PillProps["tone"] {
  switch (status) {
    case "synced":
      return "success";

    case "error":
      return "error";

    case "pending":
    case "processing":
      return "warning";

    case "not_synced":
      return "neutral";
  }
}

function jiraLabel(status: DashboardJiraStatus): string {
  switch (status) {
    case "synced":
      return "Synced";

    case "error":
      return "Sync failed";

    case "pending":
      return "Pending";

    case "processing":
      return "Syncing";

    case "not_synced":
      return "Not synced";
  }
}

function meetingStatusTone(
  status: DashboardMeeting["status"],
): PillProps["tone"] {
  if (status === "active") {
    return "accent";
  }

  if (status === "ended") {
    return "success";
  }

  return "neutral";
}

function meetingStatusLabel(status: DashboardMeeting["status"]): string {
  if (status === "active") {
    return "Live";
  }

  if (status === "ended") {
    return "Ended";
  }

  return "Created";
}

function interventionReasonLabel(intervention: DashboardIntervention): string {
  return intervention.reason === "missing_owner"
    ? "Owner clarified"
    : "Due date clarified";
}

export function OverviewDashboard() {
  const user = useAppSelector((state) => state.auth.user);

  const firstName = user?.displayName?.trim().split(/\s+/)[0] || "there";

  const { data, isLoading, isFetching, error, refetch } =
    useGetDashboardOverviewQuery();

  const { data: jiraSetup } = useGetJiraSetupQuery();

  const jiraBaseUrl = jiraSetup?.site?.url?.replace(/\/$/, "") ?? null;

  if (isLoading) {
    return (
      <LoadingState>
        <CircularProgress size={30} />
      </LoadingState>
    );
  }

  if (error || !data) {
    return (
      <DashboardRoot>
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
          Unable to load the workspace overview.
        </Alert>
      </DashboardRoot>
    );
  }

  const needsAttention = data.executionItems.filter(
    (item) =>
      item.missingOwner ||
      item.missingDueDate ||
      item.status === "blocked" ||
      item.jira.status === "error",
  );

  const resolvedInterventions = data.recentInterventions.filter(
    (intervention) => intervention.resolved,
  );

  const syncedCount = data.executionItems.filter(
    (item) => item.jira.status === "synced",
  ).length;

  const pendingSyncCount = data.executionItems.filter(
    (item) =>
      item.jira.status === "pending" || item.jira.status === "processing",
  ).length;

  const failedSyncCount = data.executionItems.filter(
    (item) => item.jira.status === "error",
  ).length;

  const openItems = data.executionItems.filter(
    (item) => item.status !== "done" && item.status !== "cancelled",
  ).length;

  return (
    <DashboardRoot>
      <Hero>
        <HeroContent>
          <PageTitle variant="h3">Welcome back, {firstName}</PageTitle>

          <PageDescription>
            Here&apos;s what Lumos captured, what needs your attention, and what
            is already moving into execution.
          </PageDescription>
        </HeroContent>

        <HeroStatus>
          <StatusCard>
            <StatusIcon>
              <PendingActionsOutlined fontSize="small" />
            </StatusIcon>

            <StatusCopy>
              <StatusLabel>Active sprint</StatusLabel>

              <StatusValue variant="body2">
                {data.activeSprint?.name ?? "No active sprint"}
              </StatusValue>
            </StatusCopy>
          </StatusCard>

          <StatusCard>
            <StatusIcon>
              {failedSyncCount > 0 ? (
                <ErrorOutlineRounded fontSize="small" />
              ) : (
                <CheckCircleOutlineRounded fontSize="small" />
              )}
            </StatusIcon>

            <StatusCopy>
              <StatusLabel>Jira delivery</StatusLabel>

              <StatusValue variant="body2">
                {failedSyncCount > 0
                  ? `${failedSyncCount} sync issue${
                      failedSyncCount === 1 ? "" : "s"
                    }`
                  : pendingSyncCount > 0
                    ? `${pendingSyncCount} item${
                        pendingSyncCount === 1 ? "" : "s"
                      } syncing`
                    : data.executionItems.length > 0
                      ? "Delivery healthy"
                      : "Waiting for execution"}
              </StatusValue>
            </StatusCopy>
          </StatusCard>
        </HeroStatus>
      </Hero>

      <SummaryGrid>
        <SummaryCard>
          <SummaryHeader>
            <SummaryLabel variant="body2">Open commitments</SummaryLabel>

            <SummaryIcon>
              <PendingActionsOutlined fontSize="small" />
            </SummaryIcon>
          </SummaryHeader>

          <SummaryValue>{openItems}</SummaryValue>

          <SummaryHint>Active execution items from meetings</SummaryHint>
        </SummaryCard>

        <SummaryCard emphasized={data.summary.needsAttention > 0}>
          <SummaryHeader>
            <SummaryLabel variant="body2">Needs attention</SummaryLabel>

            <SummaryIcon>
              <WarningAmberRounded fontSize="small" />
            </SummaryIcon>
          </SummaryHeader>

          <SummaryValue>{data.summary.needsAttention}</SummaryValue>

          <SummaryHint>Missing ownership, dates or blocked work</SummaryHint>
        </SummaryCard>

        <SummaryCard>
          <SummaryHeader>
            <SummaryLabel variant="body2">Resolved by Lumos</SummaryLabel>

            <SummaryIcon>
              <BoltRounded fontSize="small" />
            </SummaryIcon>
          </SummaryHeader>

          <SummaryValue>{data.summary.resolvedInterventions}</SummaryValue>

          <SummaryHint>Meeting gaps clarified automatically</SummaryHint>
        </SummaryCard>

        <SummaryCard>
          <SummaryHeader>
            <SummaryLabel variant="body2">Completed</SummaryLabel>

            <SummaryIcon>
              <AssignmentTurnedInOutlined fontSize="small" />
            </SummaryIcon>
          </SummaryHeader>

          <SummaryValue>{data.summary.completedItems}</SummaryValue>

          <SummaryHint>Execution items completed</SummaryHint>
        </SummaryCard>
      </SummaryGrid>

      <MainGrid>
        <Column>
          <FeaturedPanel>
            <PanelHeader>
              <PanelTitleGroup>
                <PanelTitleRow>
                  <PanelTitleIcon>
                    <BoltRounded fontSize="small" />
                  </PanelTitleIcon>

                  <PanelTitle variant="h6">Execution</PanelTitle>
                </PanelTitleRow>

                <PanelDescription variant="body2">
                  Commitments Lumos captured and moved into the active sprint.
                </PanelDescription>
              </PanelTitleGroup>

              <ViewAllLink href={ROUTES.app.sprint}>
                View sprint
                <ArrowForwardRounded fontSize="small" />
              </ViewAllLink>
            </PanelHeader>

            {data.executionItems.length === 0 ? (
              <>
                <DividerLine />

                <EmptyState>
                  <EmptyIcon>
                    <AssignmentTurnedInOutlined />
                  </EmptyIcon>

                  <EmptyCopy>
                    <EmptyTitle variant="body1">
                      No execution items yet
                    </EmptyTitle>

                    <EmptyDescription variant="body2">
                      Commitments captured from meetings will appear here with
                      ownership, due dates and Jira delivery state.
                    </EmptyDescription>
                  </EmptyCopy>
                </EmptyState>
              </>
            ) : (
              <>
                <ExecutionHeader>
                  <span>Commitment</span>
                  <span>Owner</span>
                  <span>Due date</span>
                  <span>Jira</span>
                </ExecutionHeader>

                <ExecutionList>
                  {data.executionItems.slice(0, 7).map((item) => (
                    <ExecutionRow key={item.id}>
                      <ExecutionMain>
                        <ExecutionTitle variant="body2">
                          {item.title}
                        </ExecutionTitle>

                        <ExecutionMeta>
                          <Pill tone={statusTone(item.status)}>
                            {formatStatus(item.status)}
                          </Pill>

                          {item.missingOwner ? (
                            <Pill tone="warning">
                              <GroupsOutlined fontSize="inherit" />
                              Missing owner
                            </Pill>
                          ) : null}

                          {item.missingDueDate ? (
                            <Pill tone="warning">
                              <EventOutlined fontSize="inherit" />
                              Missing due date
                            </Pill>
                          ) : null}

                          {item.blockerText ? (
                            <Pill tone="error">
                              <WarningAmberRounded fontSize="inherit" />
                              Blocked
                            </Pill>
                          ) : null}
                        </ExecutionMeta>
                      </ExecutionMain>

                      <CellText>
                        {item.ownerWorkspaceMemberId
                          ? "Assigned"
                          : "Unassigned"}
                      </CellText>

                      <CellText>
                        {item.dueAt ? formatDate(item.dueAt) : "No due date"}
                      </CellText>

                      {item.jira.issueKey && jiraBaseUrl ? (
                        <JiraLink
                          href={`${jiraBaseUrl}/browse/${encodeURIComponent(
                            item.jira.issueKey,
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <LinkOutlined fontSize="small" />

                          {item.jira.issueKey}
                        </JiraLink>
                      ) : (
                        <Pill tone={jiraTone(item.jira.status)}>
                          {item.jira.status === "processing" ? (
                            <SyncRounded fontSize="inherit" />
                          ) : null}

                          {jiraLabel(item.jira.status)}
                        </Pill>
                      )}
                    </ExecutionRow>
                  ))}
                </ExecutionList>
              </>
            )}
          </FeaturedPanel>

          <Panel>
            <PanelHeader>
              <PanelTitleGroup>
                <PanelTitleRow>
                  <PanelTitleIcon>
                    <GroupsOutlined fontSize="small" />
                  </PanelTitleIcon>

                  <PanelTitle variant="h6">Recent meetings</PanelTitle>
                </PanelTitleRow>

                <PanelDescription variant="body2">
                  Meetings currently feeding decisions and commitments into
                  Lumos.
                </PanelDescription>
              </PanelTitleGroup>

              <ViewAllLink href={ROUTES.app.meetings}>
                View meetings
                <ArrowForwardRounded fontSize="small" />
              </ViewAllLink>
            </PanelHeader>

            {data.recentMeetings.length === 0 ? (
              <>
                <DividerLine />

                <EmptyState>
                  <EmptyIcon>
                    <GroupsOutlined />
                  </EmptyIcon>

                  <EmptyCopy>
                    <EmptyTitle variant="body1">No meetings yet</EmptyTitle>

                    <EmptyDescription variant="body2">
                      Once Lumos starts processing meetings, your recent meeting
                      activity will appear here.
                    </EmptyDescription>
                  </EmptyCopy>
                </EmptyState>
              </>
            ) : (
              <MeetingList>
                {data.recentMeetings.map((meeting) => (
                  <MeetingRow key={meeting.id}>
                    <MeetingLeft>
                      <MeetingIcon>
                        <GroupsOutlined fontSize="small" />
                      </MeetingIcon>

                      <MeetingInfo>
                        <MeetingName variant="body2">
                          {meeting.roomName}
                        </MeetingName>

                        <MeetingDate variant="caption">
                          {formatDate(meeting.startedAt ?? meeting.createdAt)}
                        </MeetingDate>
                      </MeetingInfo>
                    </MeetingLeft>

                    <Pill tone={meetingStatusTone(meeting.status)}>
                      {meetingStatusLabel(meeting.status)}
                    </Pill>
                  </MeetingRow>
                ))}
              </MeetingList>
            )}
          </Panel>
        </Column>

        <Column>
          <Panel>
            <PanelHeader>
              <PanelTitleGroup>
                <PanelTitleRow>
                  <PanelTitleIcon>
                    <WarningAmberRounded fontSize="small" />
                  </PanelTitleIcon>

                  <PanelTitle variant="h6">Needs attention</PanelTitle>
                </PanelTitleRow>

                <PanelDescription variant="body2">
                  Execution gaps Lumos has identified.
                </PanelDescription>
              </PanelTitleGroup>

              {needsAttention.length > 0 ? (
                <Pill tone="warning">{needsAttention.length}</Pill>
              ) : null}
            </PanelHeader>

            {needsAttention.length === 0 ? (
              <>
                <DividerLine />

                <EmptyState>
                  <EmptyIcon>
                    <CheckCircleOutlineRounded />
                  </EmptyIcon>

                  <EmptyCopy>
                    <EmptyTitle variant="body1">Everything is clear</EmptyTitle>

                    <EmptyDescription variant="body2">
                      No missing owners, deadlines, blockers or Jira sync errors
                      right now.
                    </EmptyDescription>
                  </EmptyCopy>
                </EmptyState>
              </>
            ) : (
              <AttentionList>
                {needsAttention.slice(0, 6).map((item) => (
                  <AttentionRow key={item.id}>
                    <AttentionIcon>
                      <WarningAmberRounded fontSize="small" />
                    </AttentionIcon>

                    <AttentionText>
                      <AttentionTitle variant="body2">
                        {item.title}
                      </AttentionTitle>

                      <AttentionDescription variant="caption">
                        {item.missingOwner
                          ? "An owner still needs to be confirmed."
                          : item.missingDueDate
                            ? "A due date still needs to be confirmed."
                            : item.status === "blocked"
                              ? (item.blockerText ??
                                "Execution is currently blocked.")
                              : (item.jira.lastError ??
                                "Jira synchronization needs attention.")}
                      </AttentionDescription>
                    </AttentionText>
                  </AttentionRow>
                ))}
              </AttentionList>
            )}
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitleGroup>
                <PanelTitleRow>
                  <PanelTitleIcon>
                    <BoltRounded fontSize="small" />
                  </PanelTitleIcon>

                  <PanelTitle variant="h6">Resolved interventions</PanelTitle>
                </PanelTitleRow>

                <PanelDescription variant="body2">
                  Gaps Lumos clarified during meetings.
                </PanelDescription>
              </PanelTitleGroup>

              {resolvedInterventions.length > 0 ? (
                <Pill tone="success">{resolvedInterventions.length}</Pill>
              ) : null}
            </PanelHeader>

            {resolvedInterventions.length === 0 ? (
              <>
                <DividerLine />

                <EmptyState>
                  <EmptyIcon>
                    <CheckCircleOutlineRounded />
                  </EmptyIcon>

                  <EmptyCopy>
                    <EmptyTitle variant="body1">
                      No resolved interventions yet
                    </EmptyTitle>

                    <EmptyDescription variant="body2">
                      When Lumos asks for a missing owner or deadline and gets
                      an answer, the resolution will appear here.
                    </EmptyDescription>
                  </EmptyCopy>
                </EmptyState>
              </>
            ) : (
              <InterventionList>
                {resolvedInterventions.slice(0, 6).map((intervention) => (
                  <InterventionRow key={intervention.id}>
                    <InterventionIcon>
                      <CheckCircleOutlineRounded fontSize="small" />
                    </InterventionIcon>

                    <InterventionContent>
                      <InterventionTitle variant="body2">
                        {interventionReasonLabel(intervention)}
                      </InterventionTitle>

                      <InterventionMeta variant="caption">
                        {intervention.message}
                      </InterventionMeta>

                      {intervention.resolvedAt ? (
                        <InterventionMeta variant="caption">
                          Resolved {formatDate(intervention.resolvedAt)}
                        </InterventionMeta>
                      ) : null}
                    </InterventionContent>
                  </InterventionRow>
                ))}
              </InterventionList>
            )}
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitleGroup>
                <PanelTitleRow>
                  <PanelTitleIcon>
                    <SyncRounded fontSize="small" />
                  </PanelTitleIcon>

                  <PanelTitle variant="h6">Jira delivery</PanelTitle>
                </PanelTitleRow>

                <PanelDescription variant="body2">
                  Execution synchronization from Lumos into Jira.
                </PanelDescription>
              </PanelTitleGroup>

              <ViewAllLink href={ROUTES.app.integrations}>
                Manage
                <LaunchRounded fontSize="small" />
              </ViewAllLink>
            </PanelHeader>

            <DividerLine />

            <JiraSummary>
              <JiraStat>
                <JiraStatValue>{syncedCount}</JiraStatValue>

                <JiraStatLabel>Synced</JiraStatLabel>
              </JiraStat>

              <JiraStat>
                <JiraStatValue>{pendingSyncCount}</JiraStatValue>

                <JiraStatLabel>Pending</JiraStatLabel>
              </JiraStat>

              <JiraStat>
                <JiraStatValue>{failedSyncCount}</JiraStatValue>

                <JiraStatLabel>Failed</JiraStatLabel>
              </JiraStat>
            </JiraSummary>
          </Panel>
        </Column>
      </MainGrid>

      {isFetching ? (
        <RefreshText variant="caption">Refreshing workspace data…</RefreshText>
      ) : null}
    </DashboardRoot>
  );
}
