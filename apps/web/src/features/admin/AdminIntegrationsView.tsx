"use client";

import {
  CheckCircleOutlineRounded,
  ErrorOutlineRounded,
  LaunchRounded,
  PendingOutlined,
  SearchRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { useMemo, useState } from "react";

import { AppPage } from "@/components/layout/AppPage";
import { AppPagination } from "@/components/navigation/AppPagination";
import type { AdminIntegrationStatus } from "@/features/admin/admin.types";
import { useGetAdminIntegrationsQuery } from "@/store/api/admin-integrations.api";

const ITEMS_PER_PAGE = 10;

const ACCENT_DARK = "#A9793C";
const ACCENT_SOFT = "#F7F0E6";

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
  padding: theme.spacing(2.2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 16,
  backgroundColor: theme.palette.background.paper,
}));

const SummaryLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: 12,
  fontWeight: 600,
}));

const SummaryValue = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(1),
  color: theme.palette.text.primary,
  fontSize: 28,
  fontWeight: 750,
  lineHeight: 1,
}));

const TableCard = styled(Box)(({ theme }) => ({
  overflow: "hidden",
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 18,
  backgroundColor: theme.palette.background.paper,
}));

const TableHeader = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1.3fr 0.9fr 1.2fr 1.2fr 1fr 0.85fr",
  gap: theme.spacing(2),
  padding: theme.spacing(1.5, 2.5),
  color: theme.palette.text.secondary,
  backgroundColor: "#FAFAFB",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",

  [theme.breakpoints.down("lg")]: {
    gridTemplateColumns: "1.3fr 0.9fr 1.2fr 1.2fr 0.85fr",
  },

  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}));

const IntegrationRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1.3fr 0.9fr 1.2fr 1.2fr 1fr 0.85fr",
  gap: theme.spacing(2),
  alignItems: "center",
  minHeight: 88,
  padding: theme.spacing(1.7, 2.5),
  borderTop: `1px solid ${theme.palette.divider}`,

  [theme.breakpoints.down("lg")]: {
    gridTemplateColumns: "1.3fr 0.9fr 1.2fr 1.2fr 0.85fr",
  },

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

const ExternalLinkIcon = styled(LaunchRounded)({
  fontSize: 14,
});

const ProjectTag = styled(Box)(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  paddingInline: theme.spacing(1),
  borderRadius: 999,
  color: ACCENT_DARK,
  backgroundColor: ACCENT_SOFT,
  fontSize: 11,
  fontWeight: 700,
}));

const JiraLink = styled("a")({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  marginTop: 3,
  color: ACCENT_DARK,
  fontSize: 12,
  fontWeight: 600,
  textDecoration: "none",

  "&:hover": {
    textDecoration: "underline",
  },
});

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

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

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

function getStatusChip(status: AdminIntegrationStatus) {
  if (status === "connected") {
    return {
      label: "Connected",
      icon: <CheckCircleOutlineRounded />,
    };
  }

  if (status === "error") {
    return {
      label: "Error",
      icon: <ErrorOutlineRounded />,
    };
  }

  return {
    label: "Pending",
    icon: <PendingOutlined />,
  };
}

export function AdminIntegrationsView() {
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useGetAdminIntegrationsQuery();

  const integrations = data?.integrations ?? [];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return integrations;
    }

    return integrations.filter((integration) =>
      [
        integration.workspace.name,
        integration.workspace.slug,
        integration.status,
        integration.site.name,
        integration.site.url,
        integration.project.key,
        integration.project.name,
        integration.lastError,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [integrations, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));

  const safePage = Math.min(page, totalPages);

  const visible = filtered.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

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
          <Title variant="h3">Integrations</Title>

          <Description variant="body1">
            Monitor Jira connections, workspace setup and integration errors
            across Lumos.
          </Description>
        </HeaderCopy>

        <SearchField
          size="small"
          placeholder="Search integrations..."
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
        <ErrorAlert severity="error">Unable to load integrations.</ErrorAlert>
      ) : null}

      <SummaryGrid>
        <SummaryCard>
          <SummaryLabel>Total configured</SummaryLabel>

          <SummaryValue>{data?.summary.total ?? 0}</SummaryValue>
        </SummaryCard>

        <SummaryCard>
          <SummaryLabel>Connected</SummaryLabel>

          <SummaryValue>{data?.summary.connected ?? 0}</SummaryValue>
        </SummaryCard>

        <SummaryCard>
          <SummaryLabel>Pending</SummaryLabel>

          <SummaryValue>{data?.summary.pending ?? 0}</SummaryValue>
        </SummaryCard>

        <SummaryCard>
          <SummaryLabel>Errors</SummaryLabel>

          <SummaryValue>{data?.summary.error ?? 0}</SummaryValue>
        </SummaryCard>
      </SummaryGrid>

      <TableCard>
        <TableHeader>
          <span>Workspace</span>
          <span>Status</span>
          <span>Atlassian site</span>
          <span>Jira project</span>
          <span>Token expiry</span>
          <span>Updated</span>
        </TableHeader>

        {visible.length === 0 ? (
          <EmptyState>
            <Typography variant="body2">No integrations found.</Typography>
          </EmptyState>
        ) : (
          visible.map((integration) => {
            const status = getStatusChip(integration.status);

            return (
              <IntegrationRow key={integration.id}>
                <Box>
                  <PrimaryText variant="body2">
                    {integration.workspace.name}
                  </PrimaryText>

                  <SecondaryText variant="caption">
                    {integration.workspace.slug}
                  </SecondaryText>
                </Box>

                <Box>
                  <Chip
                    size="small"
                    variant="outlined"
                    icon={status.icon}
                    label={status.label}
                  />

                  {integration.lastError ? (
                    <SecondaryText variant="caption">
                      {integration.lastError}
                    </SecondaryText>
                  ) : null}
                </Box>

                <Box>
                  <PrimaryText variant="body2">
                    {integration.site.name ?? "Not selected"}
                  </PrimaryText>

                  {integration.site.url ? (
                    <JiraLink
                      href={integration.site.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open site
                      <ExternalLinkIcon />
                    </JiraLink>
                  ) : null}
                </Box>

                <Box>
                  {integration.project.key ? (
                    <>
                      <ProjectTag>{integration.project.key}</ProjectTag>

                      {integration.project.name ? (
                        <SecondaryText variant="caption">
                          {integration.project.name}
                        </SecondaryText>
                      ) : null}
                    </>
                  ) : (
                    <SecondaryText variant="caption">
                      Not selected
                    </SecondaryText>
                  )}
                </Box>

                <PrimaryText variant="body2">
                  {formatDate(integration.accessTokenExpiresAt)}
                </PrimaryText>

                <PrimaryText variant="body2">
                  {formatDate(integration.updatedAt)}
                </PrimaryText>
              </IntegrationRow>
            );
          })
        )}
      </TableCard>

      <AppPagination
        page={safePage}
        totalItems={filtered.length}
        itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={setPage}
        itemLabel="integrations"
        hideWhenSinglePage
      />
    </Root>
  );
}
