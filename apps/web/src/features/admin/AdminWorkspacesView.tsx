"use client";

import {
  CheckCircleOutlineRounded,
  ErrorOutlineRounded,
  LinkOffRounded,
  PendingOutlined,
  SearchRounded,
  SettingsOutlined,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  InputAdornment,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { AppDateTimePicker } from "@/components/inputs/AppDateTimePicker";
import { useEffect, useMemo, useState } from "react";

import { AppPage } from "@/components/layout/AppPage";
import { AppPagination } from "@/components/navigation/AppPagination";

import type {
  AdminWorkspaceJiraStatus,
  AdminWorkspaceListItem,
  UpdateAdminWorkspaceUsageRequest,
} from "@/features/admin/admin.types";

import {
  useGetAdminWorkspacesQuery,
  useGetAdminWorkspaceUsageQuery,
  useUpdateAdminWorkspaceUsageMutation,
} from "@/store/api/admin-workspaces.api";

const ITEMS_PER_PAGE = 10;

const Root = styled(AppPage)({});

const Header = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: theme.spacing(3),

  marginBottom: theme.spacing(3),

  [theme.breakpoints.down("md")]: {
    alignItems: "stretch",

    flexDirection: "column",
  },
}));

const HeaderCopy = styled(Box)({
  minWidth: 0,
});

const Title = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,

  fontWeight: 750,

  letterSpacing: "-0.04em",
}));

const Description = styled(Typography)(({ theme }) => ({
  maxWidth: 720,

  marginTop: theme.spacing(0.75),

  color: theme.palette.text.secondary,

  lineHeight: 1.6,
}));

const SearchField = styled(TextField)({
  width: 320,
  maxWidth: "100%",
});

const ErrorAlert = styled(Alert)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

const TableCard = styled(Box)(({ theme }) => ({
  overflow: "hidden",

  border: `1px solid ${theme.palette.divider}`,

  borderRadius: 18,

  backgroundColor: theme.palette.background.paper,
}));

const TableHeader = styled(Box)(({ theme }) => ({
  display: "grid",

  gridTemplateColumns: "1.35fr 1.4fr 0.65fr 0.65fr 1fr 0.8fr 0.7fr",

  gap: theme.spacing(2),

  padding: theme.spacing(1.5, 2.5),

  color: theme.palette.text.secondary,

  backgroundColor: "#FAFAFB",

  fontSize: 11,

  fontWeight: 700,

  textTransform: "uppercase",

  letterSpacing: "0.04em",

  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}));

const WorkspaceRow = styled(Box)(({ theme }) => ({
  display: "grid",

  gridTemplateColumns: "1.35fr 1.4fr 0.65fr 0.65fr 1fr 0.8fr 0.7fr",

  gap: theme.spacing(2),

  alignItems: "center",

  minHeight: 84,

  padding: theme.spacing(1.7, 2.5),

  borderTop: `1px solid ${theme.palette.divider}`,

  [theme.breakpoints.down("md")]: {
    display: "flex",

    alignItems: "flex-start",

    flexDirection: "column",
  },
}));

const PrimaryText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,

  fontWeight: 650,
}));

const SecondaryText = styled(Typography)(({ theme }) => ({
  display: "block",

  marginTop: 3,

  color: theme.palette.text.secondary,
}));

const Metric = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,

  fontWeight: 650,
}));

const EmptyState = styled(Box)(({ theme }) => ({
  padding: theme.spacing(7, 3),

  color: theme.palette.text.secondary,

  textAlign: "center",
}));

const Loading = styled(Box)({
  display: "flex",

  alignItems: "center",

  justifyContent: "center",

  minHeight: 500,
});

const UsageButton = styled(Button)({
  minWidth: 0,

  textTransform: "none",
});

const DialogBody = styled(Box)(({ theme }) => ({
  display: "flex",

  flexDirection: "column",

  gap: theme.spacing(2.3),

  minWidth: 520,

  paddingTop: theme.spacing(1),

  [theme.breakpoints.down("sm")]: {
    minWidth: 0,
  },
}));

const UsageSummary = styled(Box)(({ theme }) => ({
  display: "grid",

  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",

  gap: theme.spacing(1.5),

  padding: theme.spacing(2),

  border: `1px solid ${theme.palette.divider}`,

  borderRadius: 14,

  backgroundColor: "#FAFAFB",

  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
  },
}));

const UsageMetric = styled(Box)({});

const UsageMetricLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,

  fontSize: 12,
}));

const UsageMetricValue = styled(Typography)(({ theme }) => ({
  marginTop: 4,

  color: theme.palette.text.primary,

  fontWeight: 700,
}));

const Switches = styled(Box)({
  display: "flex",

  flexDirection: "column",
});

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",

    day: "numeric",

    year: "numeric",
  }).format(date);
}

function parseDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function getJiraChip(status: AdminWorkspaceJiraStatus) {
  if (status === "connected") {
    return {
      label: "Connected",

      icon: <CheckCircleOutlineRounded />,
    };
  }

  if (status === "pending") {
    return {
      label: "Pending",

      icon: <PendingOutlined />,
    };
  }

  if (status === "error") {
    return {
      label: "Error",

      icon: <ErrorOutlineRounded />,
    };
  }

  return {
    label: "Not configured",

    icon: <LinkOffRounded />,
  };
}

export function AdminWorkspacesView() {
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);

  const [selectedWorkspace, setSelectedWorkspace] =
    useState<AdminWorkspaceListItem | null>(null);

  const [form, setForm] = useState<UpdateAdminWorkspaceUsageRequest>({
    enabled: true,

    trialEndsAt: null,

    monthlyMeetingLimit: null,

    meetingCreationEnabled: true,

    livekitEnabled: true,

    disabledReason: null,
  });

  const { data = [], isLoading, error } = useGetAdminWorkspacesQuery();

  const {
    data: usage,

    isLoading: isUsageLoading,

    error: usageError,

    refetch: refetchUsage,
  } = useGetAdminWorkspaceUsageQuery(
    selectedWorkspace?.id ?? "",

    {
      skip: !selectedWorkspace,
    },
  );

  const [
    updateUsage,
    {
      isLoading: isSaving,

      error: saveError,
    },
  ] = useUpdateAdminWorkspaceUsageMutation();

  useEffect(() => {
    if (!usage) {
      return;
    }

    setForm({
      enabled: usage.enabled,

      trialEndsAt: usage.trialEndsAt,

      monthlyMeetingLimit: usage.monthlyMeetingLimit,

      meetingCreationEnabled: usage.meetingCreationEnabled,

      livekitEnabled: usage.livekitEnabled,

      disabledReason: usage.disabledReason,
    });
  }, [usage]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return data;
    }

    return data.filter((workspace) => {
      const jiraText = [
        workspace.jira.status,

        workspace.jira.siteName,

        workspace.jira.projectKey,

        workspace.jira.projectName,
      ]
        .filter(Boolean)
        .join(" ");

      return [
        workspace.name,

        workspace.slug,

        workspace.owner?.displayName,

        workspace.owner?.email,

        jiraText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [data, search]);

  const totalPages = Math.max(
    1,

    Math.ceil(filtered.length / ITEMS_PER_PAGE),
  );

  const safePage = Math.min(page, totalPages);

  const visibleWorkspaces = filtered.slice(
    (safePage - 1) * ITEMS_PER_PAGE,

    safePage * ITEMS_PER_PAGE,
  );

  const closeDialog = () => {
    if (isSaving) {
      return;
    }

    setSelectedWorkspace(null);
  };

  const saveUsage = async () => {
    if (!selectedWorkspace) {
      return;
    }

    await updateUsage({
      workspaceId: selectedWorkspace.id,

      body: form,
    }).unwrap();

    await refetchUsage();
  };

  if (isLoading) {
    return (
      <Loading>
        <CircularProgress size={30} />
      </Loading>
    );
  }

  return (
    <Root>
      <Header>
        <HeaderCopy>
          <Title variant="h3">Workspaces</Title>

          <Description variant="body1">
            Review organizations, owners, usage and Jira connectivity across
            Lumos.
          </Description>
        </HeaderCopy>

        <SearchField
          size="small"
          placeholder="Search workspaces..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);

            setPage(1);
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
      </Header>

      {error ? (
        <ErrorAlert severity="error">Unable to load workspaces.</ErrorAlert>
      ) : null}

      <TableCard>
        <TableHeader>
          <span>Workspace</span>

          <span>Owner</span>

          <span>Members</span>

          <span>Meetings</span>

          <span>Jira</span>

          <span>Created</span>

          <span>Usage</span>
        </TableHeader>

        {visibleWorkspaces.length === 0 ? (
          <EmptyState>
            <Typography variant="body2">No workspaces found.</Typography>
          </EmptyState>
        ) : (
          visibleWorkspaces.map((workspace) => {
            const jira = getJiraChip(workspace.jira.status);

            return (
              <WorkspaceRow key={workspace.id}>
                <Box>
                  <PrimaryText variant="body2">{workspace.name}</PrimaryText>

                  <SecondaryText variant="caption">
                    {workspace.slug}
                  </SecondaryText>
                </Box>

                <Box>
                  {workspace.owner ? (
                    <>
                      <PrimaryText variant="body2">
                        {workspace.owner.displayName}
                      </PrimaryText>

                      <SecondaryText variant="caption">
                        {workspace.owner.email}
                      </SecondaryText>
                    </>
                  ) : (
                    <SecondaryText variant="caption">No owner</SecondaryText>
                  )}
                </Box>

                <Metric variant="body2">{workspace.memberCount}</Metric>

                <Metric variant="body2">{workspace.meetingCount}</Metric>

                <Box>
                  <Chip
                    size="small"
                    icon={jira.icon}
                    label={jira.label}
                    variant="outlined"
                  />

                  {workspace.jira.projectKey ? (
                    <SecondaryText variant="caption">
                      {workspace.jira.projectKey}

                      {workspace.jira.projectName
                        ? ` — ${workspace.jira.projectName}`
                        : ""}
                    </SecondaryText>
                  ) : null}

                  {workspace.jira.lastError ? (
                    <SecondaryText variant="caption">
                      {workspace.jira.lastError}
                    </SecondaryText>
                  ) : null}
                </Box>

                <PrimaryText variant="body2">
                  {formatDate(workspace.createdAt)}
                </PrimaryText>

                <UsageButton
                  size="small"
                  variant="outlined"
                  startIcon={<SettingsOutlined fontSize="small" />}
                  onClick={() => setSelectedWorkspace(workspace)}
                >
                  Manage
                </UsageButton>
              </WorkspaceRow>
            );
          })
        )}
      </TableCard>

      <AppPagination
        page={safePage}
        totalItems={filtered.length}
        itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={setPage}
        itemLabel="workspaces"
        hideWhenSinglePage
      />

      <Dialog
        open={selectedWorkspace !== null}
        onClose={closeDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Usage controls
          {selectedWorkspace ? ` — ${selectedWorkspace.name}` : ""}
        </DialogTitle>

        <DialogContent>
          {usageError ? (
            <ErrorAlert severity="error">
              Unable to load workspace usage.
            </ErrorAlert>
          ) : null}

          {saveError ? (
            <ErrorAlert severity="error">
              Unable to save workspace usage.
            </ErrorAlert>
          ) : null}

          {isUsageLoading || !usage ? (
            <Loading>
              <CircularProgress size={28} />
            </Loading>
          ) : (
            <DialogBody>
              <UsageSummary>
                <UsageMetric>
                  <UsageMetricLabel>Meetings this month</UsageMetricLabel>

                  <UsageMetricValue>{usage.meetingsThisMonth}</UsageMetricValue>
                </UsageMetric>

                <UsageMetric>
                  <UsageMetricLabel>Trial status</UsageMetricLabel>

                  <UsageMetricValue>
                    {usage.trialEndsAt
                      ? usage.trialExpired
                        ? "Expired"
                        : "Active"
                      : "No trial limit"}
                  </UsageMetricValue>
                </UsageMetric>
              </UsageSummary>

              <Switches>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.enabled}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,

                          enabled: event.target.checked,
                        }))
                      }
                    />
                  }
                  label="Workspace enabled"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={form.meetingCreationEnabled}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,

                          meetingCreationEnabled: event.target.checked,
                        }))
                      }
                    />
                  }
                  label="Meeting creation enabled"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={form.livekitEnabled}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,

                          livekitEnabled: event.target.checked,
                        }))
                      }
                    />
                  }
                  label="LiveKit enabled"
                />
              </Switches>

              <AppDateTimePicker
                label="Trial ends"
                value={parseDate(form.trialEndsAt)}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,

                    trialEndsAt: value ? value.toISOString() : null,
                  }))
                }
                disablePast
                clearable
                helperText="Leave empty for no trial expiration."
              />

              <TextField
                label="Monthly meeting limit"
                type="number"
                value={form.monthlyMeetingLimit ?? ""}
                onChange={(event) => {
                  const value = event.target.value;

                  setForm((current) => ({
                    ...current,

                    monthlyMeetingLimit:
                      value === ""
                        ? null
                        : Math.max(
                            0,

                            Number.parseInt(value, 10),
                          ),
                  }));
                }}
                helperText="Leave empty for unlimited meetings."
                fullWidth
              />

              <TextField
                label="Disabled reason"
                value={form.disabledReason ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,

                    disabledReason: event.target.value || null,
                  }))
                }
                placeholder="Optional reason shown when workspace access is disabled."
                multiline
                minRows={3}
                fullWidth
              />
            </DialogBody>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={closeDialog} disabled={isSaving}>
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={() => void saveUsage()}
            disabled={isSaving || isUsageLoading || !usage}
          >
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </DialogActions>
      </Dialog>
    </Root>
  );
}
