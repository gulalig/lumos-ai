"use client";

import {
  AccessTimeRounded,
  CalendarTodayOutlined,
  CheckCircleOutlineRounded,
  ErrorOutlineRounded,
  FiberManualRecordRounded,
  GroupsOutlined,
  MeetingRoomOutlined,
  SearchRounded,
  VideocamOutlined,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppPage } from "@/components/layout/AppPage";

import { AppPagination } from "@/components/navigation/AppPagination";
import type {
  MeetingListItem,
  MeetingStatus,
} from "@/features/meetings/meetings.types";
import { useGetMeetingsQuery } from "@/store/api/meetings.api";
import { ROUTES } from "@/constants/routes";

const ACCENT_DARK = "#A9793C";
const ACCENT_SOFT = "#F7F0E6";

const ITEMS_PER_PAGE = 10;

type MeetingFilter = "all" | "active" | "ended" | "created";

interface FilterButtonProps {
  selected: boolean;
}

interface StatusBadgeProps {
  status: MeetingStatus;
}

const PageRoot = styled(AppPage)({});

const PageHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: theme.spacing(3),
  marginBottom: theme.spacing(3),

  [theme.breakpoints.down("md")]: {
    alignItems: "flex-start",
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

  [theme.breakpoints.down("sm")]: {
    fontSize: "2rem",
  },
}));

const PageDescription = styled(Typography)(({ theme }) => ({
  maxWidth: 650,
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
  gap: theme.spacing(2),
  minHeight: 104,
  padding: theme.spacing(2.25),
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

const SummaryCopy = styled(Box)({
  minWidth: 0,
});

const SummaryValue = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: 25,
  fontWeight: 750,
  lineHeight: 1,
  letterSpacing: "-0.04em",
}));

const SummaryLabel = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.55),
  color: theme.palette.text.secondary,
  fontSize: 12,
}));

const LivePanel = styled(Box)(({ theme }) => ({
  position: "relative",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(3),
  marginBottom: theme.spacing(3),
  padding: theme.spacing(2.5, 3),
  border: "1px solid rgba(200, 155, 91, 0.35)",
  borderRadius: 18,
  backgroundColor: "#FFFDF9",

  "&::after": {
    content: '""',
    position: "absolute",
    top: -55,
    right: -20,
    width: 150,
    height: 150,
    borderRadius: "50%",
    backgroundColor: "rgba(200, 155, 91, 0.07)",
  },

  [theme.breakpoints.down("sm")]: {
    alignItems: "flex-start",
    flexDirection: "column",
  },
}));

const LiveLeft = styled(Box)(({ theme }) => ({
  position: "relative",
  zIndex: 1,
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.75),
}));

const LiveIcon = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 46,
  height: 46,
  flexShrink: 0,
  borderRadius: 14,
  color: ACCENT_DARK,
  backgroundColor: ACCENT_SOFT,
});

const LiveCopy = styled(Box)({
  minWidth: 0,
});

const LiveLabel = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(0.5),
  color: "#24724A",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
}));

const LiveTitle = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.35),
  color: theme.palette.text.primary,
  fontWeight: 700,
}));

const LiveMeta = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.25),
  color: theme.palette.text.secondary,
}));

const LiveStatus = styled(Box)({
  position: "relative",
  zIndex: 1,
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
  whiteSpace: "nowrap",
});

const ToolbarPanel = styled(Box)(({ theme }) => ({
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
  alignItems: "center",
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
  transition: theme.transitions.create(["background-color", "color"]),

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

const MeetingsPanel = styled(Box)(({ theme }) => ({
  overflow: "hidden",
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 18,
  backgroundColor: theme.palette.background.paper,
}));

const TableHeader = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.7fr) 120px 165px 110px 110px",
  gap: theme.spacing(2),
  padding: theme.spacing(1.4, 2.5),
  color: theme.palette.text.secondary,
  backgroundColor: "#FAFAFB",
  fontSize: 11,
  fontWeight: 650,
  textTransform: "uppercase",
  letterSpacing: "0.04em",

  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}));

const MeetingRow = styled(Link)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.7fr) 120px 165px 110px 110px",
  color: "inherit",
  textDecoration: "none",
  alignItems: "center",
  gap: theme.spacing(2),
  minHeight: 82,
  padding: theme.spacing(1.6, 2.5),
  borderTop: `1px solid ${theme.palette.divider}`,
  transition: theme.transitions.create("background-color"),

  "&:hover": {
    backgroundColor: "#FCFCFD",
  },

  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "1fr",
    gap: theme.spacing(1),
    padding: theme.spacing(2),
  },
}));

const MeetingMain = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.4),
  minWidth: 0,
}));

const MeetingIcon = styled(Box)({
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

const MeetingInfo = styled(Box)({
  minWidth: 0,
});

const MeetingTitle = styled(Typography)(({ theme }) => ({
  overflow: "hidden",
  color: theme.palette.text.primary,
  fontWeight: 650,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}));

const MeetingId = styled(Typography)(({ theme }) => ({
  overflow: "hidden",
  maxWidth: 420,
  marginTop: theme.spacing(0.25),
  color: theme.palette.text.secondary,
  fontSize: 11,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}));

const CellText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: 13,
}));

const StatusBadge = styled(Box, {
  shouldForwardProp: (prop) => prop !== "status",
})<StatusBadgeProps>(({ status }) => {
  if (status === "active") {
    return {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      width: "fit-content",
      minHeight: 27,
      paddingInline: 9,
      borderRadius: 999,
      color: "#24724A",
      backgroundColor: "#EAF7EF",
      fontSize: 11,
      fontWeight: 650,
    };
  }

  if (status === "ended") {
    return {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      width: "fit-content",
      minHeight: 27,
      paddingInline: 9,
      borderRadius: 999,
      color: "#60636B",
      backgroundColor: "#F1F1F3",
      fontSize: 11,
      fontWeight: 650,
    };
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    width: "fit-content",
    minHeight: 27,
    paddingInline: 9,
    borderRadius: 999,
    color: "#8D652D",
    backgroundColor: ACCENT_SOFT,
    fontSize: 11,
    fontWeight: 650,
  };
});

const EmptyState = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 300,
  padding: theme.spacing(4),
  textAlign: "center",
}));

const EmptyContent = styled(Box)({
  maxWidth: 420,
});

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
  marginTop: theme.spacing(0.6),
  color: theme.palette.text.secondary,
  lineHeight: 1.6,
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
  }).format(date);
}

function formatTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(meeting: MeetingListItem): string {
  if (!meeting.startedAt) {
    return "—";
  }

  const start = new Date(meeting.startedAt);

  const end = meeting.endedAt ? new Date(meeting.endedAt) : new Date();

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "—";
  }

  const durationMs = Math.max(0, end.getTime() - start.getTime());

  const totalMinutes = Math.floor(durationMs / (1000 * 60));

  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const hours = Math.floor(totalMinutes / 60);

  const minutes = totalMinutes % 60;

  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function statusLabel(status: MeetingStatus): string {
  switch (status) {
    case "created":
      return "Created";

    case "active":
      return "Live";

    case "ended":
      return "Ended";
  }
}

function isThisWeek(value: string): boolean {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();

  const startOfWeek = new Date(now);

  const day = startOfWeek.getDay();

  const distanceFromMonday = day === 0 ? 6 : day - 1;

  startOfWeek.setDate(startOfWeek.getDate() - distanceFromMonday);

  startOfWeek.setHours(0, 0, 0, 0);

  return date >= startOfWeek && date <= now;
}

export function MeetingsView() {
  const [filter, setFilter] = useState<MeetingFilter>("all");

  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);

  const { data = [], isLoading, error, refetch } = useGetMeetingsQuery();

  const activeMeetings = data.filter((meeting) => meeting.status === "active");

  const endedMeetings = data.filter((meeting) => meeting.status === "ended");

  const thisWeekCount = data.filter((meeting) =>
    isThisWeek(meeting.startedAt ?? meeting.createdAt),
  ).length;

  const filteredMeetings = useMemo(() => {
    const query = search.trim().toLowerCase();

    return data.filter((meeting) => {
      const matchesFilter = filter === "all" || meeting.status === filter;

      const matchesSearch =
        query.length === 0 ||
        meeting.roomName.toLowerCase().includes(query) ||
        meeting.id.toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [data, filter, search]);

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredMeetings.length / ITEMS_PER_PAGE),
  );

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const paginatedMeetings = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;

    const end = start + ITEMS_PER_PAGE;

    return filteredMeetings.slice(start, end);
  }, [filteredMeetings, page]);

  if (isLoading) {
    return (
      <LoadingState>
        <CircularProgress size={30} />
      </LoadingState>
    );
  }

  if (error) {
    return (
      <PageRoot>
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              type="button"
              onClick={() => {
                void refetch();
              }}
            >
              Retry
            </Button>
          }
        >
          Unable to load meetings.
        </Alert>
      </PageRoot>
    );
  }

  return (
    <PageRoot>
      <PageHeader>
        <HeaderCopy>
          <PageTitle variant="h3">Meetings</PageTitle>

          <PageDescription variant="body1">
            Review meetings processed by Lumos and track the conversations
            feeding decisions, commitments and execution.
          </PageDescription>
        </HeaderCopy>
      </PageHeader>

      <SummaryGrid>
        <SummaryCard>
          <SummaryIcon>
            <MeetingRoomOutlined />
          </SummaryIcon>

          <SummaryCopy>
            <SummaryValue>{data.length}</SummaryValue>

            <SummaryLabel>Total meetings</SummaryLabel>
          </SummaryCopy>
        </SummaryCard>

        <SummaryCard>
          <SummaryIcon>
            <VideocamOutlined />
          </SummaryIcon>

          <SummaryCopy>
            <SummaryValue>{activeMeetings.length}</SummaryValue>

            <SummaryLabel>Live now</SummaryLabel>
          </SummaryCopy>
        </SummaryCard>

        <SummaryCard>
          <SummaryIcon>
            <CheckCircleOutlineRounded />
          </SummaryIcon>

          <SummaryCopy>
            <SummaryValue>{endedMeetings.length}</SummaryValue>

            <SummaryLabel>Completed meetings</SummaryLabel>
          </SummaryCopy>
        </SummaryCard>

        <SummaryCard>
          <SummaryIcon>
            <CalendarTodayOutlined />
          </SummaryIcon>

          <SummaryCopy>
            <SummaryValue>{thisWeekCount}</SummaryValue>

            <SummaryLabel>This week</SummaryLabel>
          </SummaryCopy>
        </SummaryCard>
      </SummaryGrid>

      {activeMeetings.length > 0 ? (
        <LivePanel>
          <LiveLeft>
            <LiveIcon>
              <VideocamOutlined />
            </LiveIcon>

            <LiveCopy>
              <LiveLabel>
                <FiberManualRecordRounded fontSize="inherit" />
                Live meeting
              </LiveLabel>

              <LiveTitle variant="body1">
                {activeMeetings[0]?.roomName}
              </LiveTitle>

              <LiveMeta variant="body2">
                Started {formatTime(activeMeetings[0]?.startedAt ?? null)}
              </LiveMeta>
            </LiveCopy>
          </LiveLeft>

          <LiveStatus>
            <FiberManualRecordRounded fontSize="inherit" />
            Lumos is listening
          </LiveStatus>
        </LivePanel>
      ) : null}

      <ToolbarPanel>
        <Filters>
          <FilterButton
            type="button"
            selected={filter === "all"}
            onClick={() => {
              setFilter("all");
            }}
          >
            All
          </FilterButton>

          <FilterButton
            type="button"
            selected={filter === "active"}
            onClick={() => {
              setFilter("active");
            }}
          >
            Live
          </FilterButton>

          <FilterButton
            type="button"
            selected={filter === "ended"}
            onClick={() => {
              setFilter("ended");
            }}
          >
            Ended
          </FilterButton>

          <FilterButton
            type="button"
            selected={filter === "created"}
            onClick={() => {
              setFilter("created");
            }}
          >
            Created
          </FilterButton>
        </Filters>

        <SearchField
          size="small"
          placeholder="Search meetings..."
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
      </ToolbarPanel>

      <MeetingsPanel>
        {filteredMeetings.length === 0 ? (
          <EmptyState>
            <EmptyContent>
              <EmptyIcon>
                {data.length === 0 ? (
                  <GroupsOutlined />
                ) : (
                  <ErrorOutlineRounded />
                )}
              </EmptyIcon>

              <EmptyTitle variant="h6">
                {data.length === 0 ? "No meetings yet" : "No matching meetings"}
              </EmptyTitle>

              <EmptyDescription variant="body2">
                {data.length === 0
                  ? "Once Lumos joins and processes a meeting, its history and execution context will appear here."
                  : "Try changing the status filter or searching for a different meeting."}
              </EmptyDescription>
            </EmptyContent>
          </EmptyState>
        ) : (
          <>
            <TableHeader>
              <span>Meeting</span>

              <span>Status</span>

              <span>Date</span>

              <span>Start</span>

              <span>Duration</span>
            </TableHeader>

            {paginatedMeetings.map((meeting) => (
              <MeetingRow
                key={meeting.id}
                href={`${ROUTES.app.meetings}/${meeting.id}`}
              >
                <MeetingMain>
                  <MeetingIcon>
                    <GroupsOutlined fontSize="small" />
                  </MeetingIcon>

                  <MeetingInfo>
                    <MeetingTitle variant="body2">
                      {meeting.roomName}
                    </MeetingTitle>

                    <MeetingId>{meeting.id}</MeetingId>
                  </MeetingInfo>
                </MeetingMain>

                <StatusBadge status={meeting.status}>
                  {meeting.status === "active" ? (
                    <FiberManualRecordRounded fontSize="inherit" />
                  ) : meeting.status === "ended" ? (
                    <CheckCircleOutlineRounded fontSize="inherit" />
                  ) : (
                    <AccessTimeRounded fontSize="inherit" />
                  )}

                  {statusLabel(meeting.status)}
                </StatusBadge>

                <CellText>
                  {formatDate(meeting.startedAt ?? meeting.createdAt)}
                </CellText>

                <CellText>{formatTime(meeting.startedAt)}</CellText>

                <CellText>{formatDuration(meeting)}</CellText>
              </MeetingRow>
            ))}

            <AppPagination
              page={page}
              totalItems={filteredMeetings.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setPage}
              itemLabel="meetings"
            />
          </>
        )}
      </MeetingsPanel>
    </PageRoot>
  );
}
