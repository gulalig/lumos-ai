"use client";

import {
  AssignmentOutlined,
  BoltRounded,
  CalendarTodayOutlined,
  CheckCircleOutlineRounded,
  ErrorOutlineRounded,
  GroupsOutlined,
  LinkOutlined,
  SearchRounded,
  SyncRounded,
  WarningAmberRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { AppPage } from "@/components/layout/AppPage";
import { styled } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";
import { useGetJiraSetupQuery } from "@/store/api/jira.api";

import { AppPagination } from "@/components/navigation/AppPagination";
import type {
  DashboardExecutionItem,
  DashboardExecutionStatus,
  DashboardJiraStatus,
} from "@/features/dashboard/dashboard.types";
import { useGetDashboardOverviewQuery } from "@/store/api/dashboard.api";
import { useUpdateSprintItemMutation } from "@/store/api/sprints.api";

const ACCENT_DARK = "#A9793C";
const ACCENT_SOFT = "#F7F0E6";

const ITEMS_PER_PAGE = 10;

type SprintFilter = "all" | "todo" | "in_progress" | "blocked" | "done";

interface FilterButtonProps {
  selected: boolean;
}

interface StatusPillProps {
  status: DashboardExecutionStatus;
}

interface JiraPillProps {
  status: DashboardJiraStatus;
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
  maxWidth: 700,
  marginTop: theme.spacing(0.8),
  color: theme.palette.text.secondary,
  lineHeight: 1.65,
}));

const ActiveSprintBadge = styled(Box)(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing(0.8),
  minHeight: 36,
  paddingInline: theme.spacing(1.4),
  border: "1px solid rgba(200, 155, 91, 0.28)",
  borderRadius: 999,
  color: ACCENT_DARK,
  backgroundColor: "#FFFDF9",
  fontSize: 12,
  fontWeight: 650,
  whiteSpace: "nowrap",
}));

const ActiveDot = styled(Box)({
  width: 7,
  height: 7,
  borderRadius: "50%",
  backgroundColor: "#4D9B68",
});

const SprintHero = styled(Box)(({ theme }) => ({
  position: "relative",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(3),
  marginBottom: theme.spacing(3),
  padding: theme.spacing(3),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 18,
  backgroundColor: theme.palette.background.paper,

  [theme.breakpoints.down("md")]: {
    alignItems: "flex-start",
    flexDirection: "column",
  },
}));

const SprintHeroCopy = styled(Box)({
  position: "relative",
  zIndex: 1,
  minWidth: 0,
});

const SprintName = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 720,
  letterSpacing: "-0.025em",
}));

const SprintGoal = styled(Typography)(({ theme }) => ({
  maxWidth: 700,
  marginTop: theme.spacing(0.6),
  color: theme.palette.text.secondary,
  lineHeight: 1.55,
}));

const SprintDates = styled(Box)(({ theme }) => ({
  position: "relative",
  zIndex: 1,
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
  color: theme.palette.text.secondary,
  fontSize: 12,
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

const SprintPanel = styled(Box)(({ theme }) => ({
  overflow: "hidden",
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 18,
  backgroundColor: theme.palette.background.paper,
}));

const TableHeader = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.65fr) 145px 120px 130px 130px",
  gap: theme.spacing(2),
  padding: theme.spacing(1.35, 2.5),
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

const SprintRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.65fr) 145px 120px 130px 130px",
  alignItems: "center",
  gap: theme.spacing(2),
  minHeight: 90,
  padding: theme.spacing(1.7, 2.5),
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

const ItemMain = styled(Box)({
  minWidth: 0,
});

const ItemTitle = styled(Typography)(({ theme }) => ({
  overflow: "hidden",
  color: theme.palette.text.primary,
  fontWeight: 650,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",

  [theme.breakpoints.down("md")]: {
    whiteSpace: "normal",
  },
}));

const ItemDescription = styled(Typography)(({ theme }) => ({
  overflow: "hidden",
  maxWidth: 560,
  marginTop: theme.spacing(0.35),
  color: theme.palette.text.secondary,
  fontSize: 12,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}));

const ItemMeta = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing(0.55),
  marginTop: theme.spacing(0.75),
}));

const GapPill = styled(Box)({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  minHeight: 24,
  paddingInline: 8,
  borderRadius: 999,
  color: "#8A5B16",
  backgroundColor: "#FFF3DC",
  fontSize: 11,
  fontWeight: 650,
});

const BlockedPill = styled(GapPill)({
  color: "#B23B3B",
  backgroundColor: "#FCECEC",
});

const StatusPill = styled(Box, {
  shouldForwardProp: (prop) => prop !== "status",
})<StatusPillProps>(({ status }) => {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    minHeight: 27,
    paddingInline: 9,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 650,
  };

  if (status === "done") {
    return {
      ...base,
      color: "#24724A",
      backgroundColor: "#EAF7EF",
    };
  }

  if (status === "blocked") {
    return {
      ...base,
      color: "#B23B3B",
      backgroundColor: "#FCECEC",
    };
  }

  if (status === "in_progress") {
    return {
      ...base,
      color: "#8D652D",
      backgroundColor: ACCENT_SOFT,
    };
  }

  return {
    ...base,
    color: "#60636B",
    backgroundColor: "#F1F1F3",
  };
});

const JiraPill = styled(Box, {
  shouldForwardProp: (prop) => prop !== "status",
})<JiraPillProps>(({ status }) => {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    width: "fit-content",
    minHeight: 27,
    paddingInline: 9,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 650,
  };

  if (status === "synced") {
    return {
      ...base,
      color: "#24724A",
      backgroundColor: "#EAF7EF",
    };
  }

  if (status === "error") {
    return {
      ...base,
      color: "#B23B3B",
      backgroundColor: "#FCECEC",
    };
  }

  if (status === "pending" || status === "processing") {
    return {
      ...base,
      color: "#8A5B16",
      backgroundColor: "#FFF3DC",
    };
  }

  return {
    ...base,
    color: "#60636B",
    backgroundColor: "#F1F1F3",
  };
});

const JiraAnchor = styled("a")({
  display: "inline-flex",

  width: "fit-content",

  textDecoration: "none",
});

const StatusSelect = styled(Select<DashboardExecutionStatus>)(({ theme }) => ({
  minWidth: 130,
  height: 36,
  borderRadius: 10,
  backgroundColor: theme.palette.background.paper,
  fontSize: 12,

  "& .MuiSelect-select": {
    paddingTop: 7,
    paddingBottom: 7,
  },
}));

const CellText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: 13,
}));

const EmptyState = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 320,
  padding: theme.spacing(4),
  textAlign: "center",
}));

const EmptyContent = styled(Box)({
  maxWidth: 440,
});

const EmptyIcon = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 52,
  height: 52,
  marginInline: "auto",
  marginBottom: 16,
  borderRadius: 15,
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

function statusLabel(status: DashboardExecutionStatus): string {
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

function jiraLabel(status: DashboardJiraStatus): string {
  switch (status) {
    case "not_synced":
      return "Not synced";

    case "pending":
      return "Pending";

    case "processing":
      return "Syncing";

    case "synced":
      return "Synced";

    case "error":
      return "Failed";
  }
}

function matchesFilter(
  item: DashboardExecutionItem,
  filter: SprintFilter,
): boolean {
  if (filter === "all") {
    return true;
  }

  return item.status === filter;
}

export function SprintView() {
  const [filter, setFilter] = useState<SprintFilter>("all");

  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useGetDashboardOverviewQuery();

  const { data: jiraSetup } = useGetJiraSetupQuery();

  const jiraBaseUrl = jiraSetup?.site?.url?.replace(/\/$/, "") ?? null;

  const [updateSprintItem, { isLoading: isUpdating }] =
    useUpdateSprintItemMutation();

  const items = data?.executionItems ?? [];

  const todoCount = items.filter((item) => item.status === "todo").length;

  const inProgressCount = items.filter(
    (item) => item.status === "in_progress",
  ).length;

  const blockedCount = items.filter((item) => item.status === "blocked").length;

  const doneCount = items.filter((item) => item.status === "done").length;

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const filterMatches = matchesFilter(item, filter);

      const searchMatches =
        query.length === 0 ||
        item.title.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) === true ||
        item.jira.issueKey?.toLowerCase().includes(query) === true;

      return filterMatches && searchMatches;
    });
  }, [items, filter, search]);

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredItems.length / ITEMS_PER_PAGE),
  );

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;

    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, page]);

  const handleStatusChange = async (
    itemId: string,
    status: DashboardExecutionStatus,
  ) => {
    try {
      await updateSprintItem({
        itemId,

        body: {
          status,
        },
      }).unwrap();

      await refetch();
    } catch {
      // Mutation state can be surfaced later with a toast system.
    }
  };

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
          Unable to load sprint execution.
        </Alert>
      </PageRoot>
    );
  }

  return (
    <PageRoot>
      <PageHeader>
        <HeaderCopy>
          <PageTitle variant="h3">Sprint</PageTitle>

          <PageDescription variant="body1">
            Track commitments Lumos moved from conversation into accountable
            execution and Jira delivery.
          </PageDescription>
        </HeaderCopy>

        {data.activeSprint ? (
          <ActiveSprintBadge>
            <ActiveDot />
            Active sprint
          </ActiveSprintBadge>
        ) : null}
      </PageHeader>

      {data.activeSprint ? (
        <SprintHero>
          <SprintHeroCopy>
            <SprintName variant="h5">{data.activeSprint.name}</SprintName>

            <SprintGoal variant="body2">
              {data.activeSprint.goal ?? "No sprint goal has been defined."}
            </SprintGoal>
          </SprintHeroCopy>

          <SprintDates>
            <CalendarTodayOutlined fontSize="small" />

            {formatDate(data.activeSprint.startsAt)}

            <span>→</span>

            {formatDate(data.activeSprint.endsAt)}
          </SprintDates>
        </SprintHero>
      ) : null}

      <SummaryGrid>
        <SummaryCard>
          <SummaryIcon>
            <AssignmentOutlined />
          </SummaryIcon>

          <SummaryCopy>
            <SummaryValue>{todoCount}</SummaryValue>

            <SummaryLabel>To do</SummaryLabel>
          </SummaryCopy>
        </SummaryCard>

        <SummaryCard>
          <SummaryIcon>
            <BoltRounded />
          </SummaryIcon>

          <SummaryCopy>
            <SummaryValue>{inProgressCount}</SummaryValue>

            <SummaryLabel>In progress</SummaryLabel>
          </SummaryCopy>
        </SummaryCard>

        <SummaryCard>
          <SummaryIcon>
            <WarningAmberRounded />
          </SummaryIcon>

          <SummaryCopy>
            <SummaryValue>{blockedCount}</SummaryValue>

            <SummaryLabel>Blocked</SummaryLabel>
          </SummaryCopy>
        </SummaryCard>

        <SummaryCard>
          <SummaryIcon>
            <CheckCircleOutlineRounded />
          </SummaryIcon>

          <SummaryCopy>
            <SummaryValue>{doneCount}</SummaryValue>

            <SummaryLabel>Completed</SummaryLabel>
          </SummaryCopy>
        </SummaryCard>
      </SummaryGrid>

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
            selected={filter === "todo"}
            onClick={() => {
              setFilter("todo");
            }}
          >
            To do
          </FilterButton>

          <FilterButton
            type="button"
            selected={filter === "in_progress"}
            onClick={() => {
              setFilter("in_progress");
            }}
          >
            In progress
          </FilterButton>

          <FilterButton
            type="button"
            selected={filter === "blocked"}
            onClick={() => {
              setFilter("blocked");
            }}
          >
            Blocked
          </FilterButton>

          <FilterButton
            type="button"
            selected={filter === "done"}
            onClick={() => {
              setFilter("done");
            }}
          >
            Done
          </FilterButton>
        </Filters>

        <SearchField
          size="small"
          placeholder="Search execution..."
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

      <SprintPanel>
        {!data.activeSprint ? (
          <EmptyState>
            <EmptyContent>
              <EmptyIcon>
                <AssignmentOutlined />
              </EmptyIcon>

              <EmptyTitle variant="h6">No active sprint</EmptyTitle>

              <EmptyDescription variant="body2">
                Once Lumos has an active execution sprint, commitments captured
                from meetings will appear here.
              </EmptyDescription>
            </EmptyContent>
          </EmptyState>
        ) : filteredItems.length === 0 ? (
          <EmptyState>
            <EmptyContent>
              <EmptyIcon>
                {items.length === 0 ? (
                  <AssignmentOutlined />
                ) : (
                  <ErrorOutlineRounded />
                )}
              </EmptyIcon>

              <EmptyTitle variant="h6">
                {items.length === 0
                  ? "No execution items yet"
                  : "No matching items"}
              </EmptyTitle>

              <EmptyDescription variant="body2">
                {items.length === 0
                  ? "Commitments captured by Lumos will appear here once they move into execution."
                  : "Try changing the status filter or searching for another commitment."}
              </EmptyDescription>
            </EmptyContent>
          </EmptyState>
        ) : (
          <>
            <TableHeader>
              <span>Commitment</span>
              <span>Status</span>
              <span>Owner</span>
              <span>Due date</span>
              <span>Jira</span>
            </TableHeader>

            {paginatedItems.map((item) => (
              <SprintRow key={item.id}>
                <ItemMain>
                  <ItemTitle variant="body2">{item.title}</ItemTitle>

                  {item.description ? (
                    <ItemDescription>{item.description}</ItemDescription>
                  ) : null}

                  <ItemMeta>
                    {item.missingOwner ? (
                      <GapPill>
                        <GroupsOutlined fontSize="inherit" />
                        Missing owner
                      </GapPill>
                    ) : null}

                    {item.missingDueDate ? (
                      <GapPill>
                        <CalendarTodayOutlined fontSize="inherit" />
                        Missing due date
                      </GapPill>
                    ) : null}

                    {item.blockerText ? (
                      <BlockedPill>
                        <WarningAmberRounded fontSize="inherit" />
                        {item.blockerText}
                      </BlockedPill>
                    ) : null}
                  </ItemMeta>
                </ItemMain>

                <Box>
                  <StatusSelect
                    value={item.status}
                    disabled={isUpdating}
                    onChange={(event) => {
                      void handleStatusChange(
                        item.id,
                        event.target.value as DashboardExecutionStatus,
                      );
                    }}
                  >
                    <MenuItem value="todo">To do</MenuItem>

                    <MenuItem value="in_progress">In progress</MenuItem>

                    <MenuItem value="blocked">Blocked</MenuItem>

                    <MenuItem value="done">Done</MenuItem>

                    <MenuItem value="cancelled">Cancelled</MenuItem>
                  </StatusSelect>
                </Box>

                <CellText>
                  {item.ownerWorkspaceMemberId ? "Assigned" : "Unassigned"}
                </CellText>

                <CellText>
                  {item.dueAt ? formatDate(item.dueAt) : "No due date"}
                </CellText>

                <Box>
                  {item.jira.issueKey && jiraBaseUrl ? (
                    <JiraAnchor
                      href={`${jiraBaseUrl}/browse/${encodeURIComponent(
                        item.jira.issueKey,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <JiraPill status="synced">
                        <LinkOutlined fontSize="inherit" />

                        {item.jira.issueKey}
                      </JiraPill>
                    </JiraAnchor>
                  ) : (
                    <JiraPill status={item.jira.status}>
                      {item.jira.status === "processing" ? (
                        <SyncRounded fontSize="inherit" />
                      ) : item.jira.status === "error" ? (
                        <ErrorOutlineRounded fontSize="inherit" />
                      ) : item.jira.status === "synced" ? (
                        <CheckCircleOutlineRounded fontSize="inherit" />
                      ) : null}

                      {jiraLabel(item.jira.status)}
                    </JiraPill>
                  )}
                </Box>
              </SprintRow>
            ))}

            <AppPagination
              page={page}
              totalItems={filteredItems.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setPage}
              itemLabel="items"
            />
          </>
        )}
      </SprintPanel>
    </PageRoot>
  );
}
