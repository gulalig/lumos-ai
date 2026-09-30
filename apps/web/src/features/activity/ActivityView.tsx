"use client";

import {
  AssignmentTurnedInOutlined,
  BoltRounded,
  CheckCircleOutlineRounded,
  ErrorOutlineRounded,
  GroupsOutlined,
  LinkOutlined,
  SearchRounded,
  SyncRounded,
  VideocamOutlined,
  WarningAmberRounded,
} from "@mui/icons-material";
import { AppPage } from "@/components/layout/AppPage";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import { useGetJiraSetupQuery } from "@/store/api/jira.api";
import { styled } from "@mui/material/styles";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppPagination } from "@/components/navigation/AppPagination";
import { ROUTES } from "@/constants/routes";
import type {
  ActivityCategory,
  ActivityEntry,
  ActivityTone,
} from "@/features/activity/activity.types";
import { useGetActivityQuery } from "@/store/api/activity.api";

const ACCENT_DARK = "#A9793C";
const ACCENT_SOFT = "#F7F0E6";

const ITEMS_PER_PAGE = 12;

type ActivityFilter = "all" | ActivityCategory;

interface FilterButtonProps {
  selected: boolean;
}

interface TimelineIconProps {
  tone: ActivityTone;
}

const PageRoot = styled(AppPage)({});

const Header = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(3),
}));

const PageTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 750,
  letterSpacing: "-0.04em",
}));

const PageDescription = styled(Typography)(({ theme }) => ({
  maxWidth: 700,
  marginTop: theme.spacing(0.8),
  color: theme.palette.text.secondary,
  lineHeight: 1.65,
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

const SummaryCard = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.75),
  minHeight: 104,
  padding: theme.spacing(2.2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 16,
  backgroundColor: theme.palette.background.paper,
}));

const SummaryIcon = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 42,
  height: 42,
  flexShrink: 0,
  borderRadius: 12,
  color: ACCENT_DARK,
  backgroundColor: ACCENT_SOFT,
});

const SummaryValue = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: 25,
  fontWeight: 750,
  lineHeight: 1,
}));

const SummaryLabel = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.55),
  color: theme.palette.text.secondary,
  fontSize: 12,
}));

const Toolbar = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(2),
  marginBottom: theme.spacing(2),
  padding: theme.spacing(1.25),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 16,
  backgroundColor: theme.palette.background.paper,

  [theme.breakpoints.down("md")]: {
    alignItems: "stretch",
    flexDirection: "column",
  },
}));

const Filters = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(0.5),
}));

const FilterButton = styled("button", {
  shouldForwardProp: (prop) => prop !== "selected",
})<FilterButtonProps>(({ theme, selected }) => ({
  minHeight: 36,
  paddingInline: theme.spacing(1.5),
  border: 0,
  borderRadius: 10,
  color: selected ? theme.palette.text.primary : theme.palette.text.secondary,
  backgroundColor: selected ? theme.palette.action.selected : "transparent",
  cursor: "pointer",
  font: "inherit",
  fontSize: 13,
  fontWeight: selected ? 650 : 500,

  "&:hover": {
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.action.hover,
  },
}));

const SearchField = styled(TextField)(({ theme }) => ({
  width: 280,

  [theme.breakpoints.down("md")]: {
    width: "100%",
  },
}));

const FeedPanel = styled(Box)(({ theme }) => ({
  overflow: "hidden",
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 18,
  backgroundColor: theme.palette.background.paper,
}));

const Timeline = styled(Box)({
  display: "grid",
});

const ActivityRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "48px minmax(0, 1fr) auto",
  gap: theme.spacing(1.5),
  padding: theme.spacing(2.1, 2.5),
  borderTop: `1px solid ${theme.palette.divider}`,

  "&:first-of-type": {
    borderTop: 0,
  },

  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "42px minmax(0, 1fr)",
  },
}));

const IconColumn = styled(Box)({
  position: "relative",
});

const TimelineIcon = styled(Box, {
  shouldForwardProp: (prop) => prop !== "tone",
})<TimelineIconProps>(({ tone }) => {
  const variants = {
    neutral: {
      color: "#666A73",
      backgroundColor: "#F1F1F3",
    },

    active: {
      color: "#8D652D",
      backgroundColor: ACCENT_SOFT,
    },

    success: {
      color: "#24724A",
      backgroundColor: "#EAF7EF",
    },

    warning: {
      color: "#8A5B16",
      backgroundColor: "#FFF3DC",
    },

    error: {
      color: "#B23B3B",
      backgroundColor: "#FCECEC",
    },
  };

  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 38,
    height: 38,
    borderRadius: 11,
    ...variants[tone],
  };
});

const ActivityContent = styled(Box)({
  minWidth: 0,
});

const ActivityTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 650,
}));

const ActivityDescription = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.35),
  color: theme.palette.text.secondary,
  lineHeight: 1.5,
}));

const ActivityMeta = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing(0.8),
  marginTop: theme.spacing(0.9),
}));

const CategoryPill = styled(Box)({
  minHeight: 24,
  paddingInline: 8,
  borderRadius: 999,
  color: "#666A73",
  backgroundColor: "#F1F1F3",
  fontSize: 11,
  fontWeight: 650,
  lineHeight: "24px",
  textTransform: "capitalize",
});

const ContextLink = styled(Link)(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing(0.4),
  color: ACCENT_DARK,
  fontSize: 11,
  fontWeight: 650,
  textDecoration: "none",

  "&:hover": {
    color: "#8F642E",
  },
}));

const JiraIssueLink = styled("a")(({ theme }) => ({
  display: "inline-flex",

  alignItems: "center",

  gap: theme.spacing(0.4),

  color: ACCENT_DARK,

  fontSize: 11,

  fontWeight: 650,

  textDecoration: "none",

  "&:hover": {
    color: "#8F642E",

    textDecoration: "underline",
  },
}));

const Time = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: 12,
  whiteSpace: "nowrap",

  [theme.breakpoints.down("sm")]: {
    gridColumn: "2",
  },
}));

const EmptyState = styled(Box)(({ theme }) => ({
  padding: theme.spacing(6, 3),
  textAlign: "center",
}));

const EmptyIcon = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 50,
  height: 50,
  marginInline: "auto",
  marginBottom: 16,
  borderRadius: 14,
  color: ACCENT_DARK,
  backgroundColor: ACCENT_SOFT,
});

const EmptyTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 700,
}));

const EmptyDescription = styled(Typography)(({ theme }) => ({
  maxWidth: 440,
  marginInline: "auto",
  marginTop: theme.spacing(0.6),
  color: theme.palette.text.secondary,
}));

const LoadingState = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 520,
});

function activityIcon(activity: ActivityEntry) {
  switch (activity.category) {
    case "meeting":
      return <VideocamOutlined fontSize="small" />;

    case "execution":
      return <AssignmentTurnedInOutlined fontSize="small" />;

    case "intervention":
      return <BoltRounded fontSize="small" />;

    case "jira":
      if (activity.type === "jira_failed") {
        return <ErrorOutlineRounded fontSize="small" />;
      }

      if (activity.type === "jira_synced") {
        return <CheckCircleOutlineRounded fontSize="small" />;
      }

      return <SyncRounded fontSize="small" />;
  }
}

function formatActivityTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const now = new Date();

  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);

  if (minutes >= 0 && minutes < 1) {
    return "Just now";
  }

  if (minutes >= 1 && minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours >= 1 && hours < 24) {
    return `${hours}h ago`;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ActivityView() {
  const [filter, setFilter] = useState<ActivityFilter>("all");

  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useGetActivityQuery();

  const { data: jiraSetup } = useGetJiraSetupQuery();

  const jiraBaseUrl = jiraSetup?.site?.url?.replace(/\/$/, "") ?? null;

  const activities = data?.activities ?? [];

  const filteredActivities = useMemo(() => {
    const query = search.trim().toLowerCase();

    return activities.filter((activity) => {
      const filterMatches = filter === "all" || activity.category === filter;

      const searchMatches =
        query.length === 0 ||
        activity.title.toLowerCase().includes(query) ||
        activity.description?.toLowerCase().includes(query) === true ||
        activity.jiraIssueKey?.toLowerCase().includes(query) === true;

      return filterMatches && searchMatches;
    });
  }, [activities, filter, search]);

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredActivities.length / ITEMS_PER_PAGE),
  );

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const paginated = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;

    return filteredActivities.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredActivities, page]);

  if (isLoading) {
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
          Unable to load workspace activity.
        </Alert>
      </PageRoot>
    );
  }

  return (
    <PageRoot>
      <Header>
        <PageTitle variant="h3">Activity</PageTitle>

        <PageDescription>
          Follow how Lumos turns meeting conversations into execution, resolves
          missing context and delivers work into Jira.
        </PageDescription>
      </Header>

      <SummaryGrid>
        <SummaryCard>
          <SummaryIcon>
            <BoltRounded />
          </SummaryIcon>

          <Box>
            <SummaryValue>{data.summary.total}</SummaryValue>

            <SummaryLabel>Activity events</SummaryLabel>
          </Box>
        </SummaryCard>

        <SummaryCard>
          <SummaryIcon>
            <GroupsOutlined />
          </SummaryIcon>

          <Box>
            <SummaryValue>{data.summary.meetings}</SummaryValue>

            <SummaryLabel>Meetings processed</SummaryLabel>
          </Box>
        </SummaryCard>

        <SummaryCard>
          <SummaryIcon>
            <CheckCircleOutlineRounded />
          </SummaryIcon>

          <Box>
            <SummaryValue>{data.summary.resolvedInterventions}</SummaryValue>

            <SummaryLabel>Gaps resolved</SummaryLabel>
          </Box>
        </SummaryCard>

        <SummaryCard>
          <SummaryIcon>
            <LinkOutlined />
          </SummaryIcon>

          <Box>
            <SummaryValue>{data.summary.jiraSynced}</SummaryValue>

            <SummaryLabel>Jira deliveries</SummaryLabel>
          </Box>
        </SummaryCard>
      </SummaryGrid>

      <Toolbar>
        <Filters>
          {(
            [
              ["all", "All"],
              ["meeting", "Meetings"],
              ["execution", "Execution"],
              ["intervention", "Interventions"],
              ["jira", "Jira"],
            ] as const
          ).map(([value, label]) => (
            <FilterButton
              key={value}
              type="button"
              selected={filter === value}
              onClick={() => {
                setFilter(value);
              }}
            >
              {label}
            </FilterButton>
          ))}
        </Filters>

        <SearchField
          size="small"
          placeholder="Search activity..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
      </Toolbar>

      <FeedPanel>
        {filteredActivities.length === 0 ? (
          <EmptyState>
            <EmptyIcon>
              {activities.length === 0 ? (
                <BoltRounded />
              ) : (
                <WarningAmberRounded />
              )}
            </EmptyIcon>

            <EmptyTitle variant="h6">
              {activities.length === 0
                ? "No activity yet"
                : "No matching activity"}
            </EmptyTitle>

            <EmptyDescription variant="body2">
              {activities.length === 0
                ? "As Lumos processes meetings, resolves execution gaps and syncs work to Jira, the activity timeline will appear here."
                : "Try another filter or search term."}
            </EmptyDescription>
          </EmptyState>
        ) : (
          <>
            <Timeline>
              {paginated.map((activity) => (
                <ActivityRow key={activity.id}>
                  <IconColumn>
                    <TimelineIcon tone={activity.tone}>
                      {activityIcon(activity)}
                    </TimelineIcon>
                  </IconColumn>

                  <ActivityContent>
                    <ActivityTitle variant="body2">
                      {activity.title}
                    </ActivityTitle>

                    {activity.description ? (
                      <ActivityDescription variant="body2">
                        {activity.description}
                      </ActivityDescription>
                    ) : null}

                    <ActivityMeta>
                      <CategoryPill>{activity.category}</CategoryPill>

                      {activity.meetingId ? (
                        <ContextLink
                          href={`${ROUTES.app.meetings}/${activity.meetingId}`}
                        >
                          View meeting
                        </ContextLink>
                      ) : null}

                      {activity.sprintItemId ? (
                        <ContextLink href={ROUTES.app.sprint}>
                          View execution
                        </ContextLink>
                      ) : null}

                      {activity.jiraIssueKey && jiraBaseUrl ? (
                        <JiraIssueLink
                          href={`${jiraBaseUrl}/browse/${encodeURIComponent(
                            activity.jiraIssueKey,
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {activity.jiraIssueKey}
                        </JiraIssueLink>
                      ) : activity.jiraIssueKey ? (
                        <CategoryPill>{activity.jiraIssueKey}</CategoryPill>
                      ) : null}
                    </ActivityMeta>
                  </ActivityContent>

                  <Time>{formatActivityTime(activity.occurredAt)}</Time>
                </ActivityRow>
              ))}
            </Timeline>

            <AppPagination
              page={page}
              totalItems={filteredActivities.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setPage}
              itemLabel="events"
            />
          </>
        )}
      </FeedPanel>
    </PageRoot>
  );
}
