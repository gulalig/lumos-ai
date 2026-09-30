"use client";

import {
  CheckCircleOutlineRounded,
  ErrorOutlineRounded,
  StorageOutlined,
  SyncRounded,
} from "@mui/icons-material";
import { Alert, Box, Chip, CircularProgress, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

import { AppPage } from "@/components/layout/AppPage";
import { useGetAdminSystemQuery } from "@/store/api/admin-system.api";

const Root = styled(AppPage)({});

const Header = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(3),
}));

const Title = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 750,
  letterSpacing: "-0.04em",
}));

const Description = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.75),
  color: theme.palette.text.secondary,
  lineHeight: 1.6,
}));

const HealthGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: theme.spacing(2),
  marginBottom: theme.spacing(3),

  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "1fr",
  },
}));

const Card = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2.4),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 18,
  backgroundColor: theme.palette.background.paper,
}));

const CardHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(2),
}));

const CardTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontWeight: 600,
}));

const CardValue = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(1.8),
  color: theme.palette.text.primary,
  fontSize: 28,
  fontWeight: 750,
}));

const QueueGrid = styled(Box)(({ theme }) => ({
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

const Panel = styled(Box)(({ theme }) => ({
  overflow: "hidden",
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 18,
  backgroundColor: theme.palette.background.paper,
}));

const PanelHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2.4, 2.5),
}));

const ErrorRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1.2fr 0.6fr 2fr 0.8fr",
  gap: theme.spacing(2),
  alignItems: "center",
  padding: theme.spacing(1.6, 2.5),
  borderTop: `1px solid ${theme.palette.divider}`,

  [theme.breakpoints.down("md")]: {
    display: "flex",
    alignItems: "flex-start",
    flexDirection: "column",
  },
}));

const Primary = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 650,
}));

const Secondary = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
}));

const Loading = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 500,
});

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function AdminSystemView() {
  const { data, isLoading, error } = useGetAdminSystemQuery();

  if (isLoading) {
    return (
      <Loading>
        <CircularProgress size={30} />
      </Loading>
    );
  }

  if (error || !data) {
    return (
      <Root>
        <Alert severity="error">Unable to load system status.</Alert>
      </Root>
    );
  }

  return (
    <Root>
      <Header>
        <Title variant="h3">System</Title>

        <Description variant="body1">
          Monitor Lumos infrastructure and Jira delivery operations.
        </Description>
      </Header>

      <HealthGrid>
        <Card>
          <CardHeader>
            <CardTitle>PostgreSQL</CardTitle>

            <StorageOutlined />
          </CardHeader>

          <CardValue>
            {data.health.postgres === "up" ? "Operational" : "Unavailable"}
          </CardValue>

          <Chip
            size="small"
            variant="outlined"
            icon={
              data.health.postgres === "up" ? (
                <CheckCircleOutlineRounded />
              ) : (
                <ErrorOutlineRounded />
              )
            }
            label={data.health.postgres}
          />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Redis</CardTitle>

            <StorageOutlined />
          </CardHeader>

          <CardValue>
            {data.health.redis === "up" ? "Operational" : "Unavailable"}
          </CardValue>

          <Chip
            size="small"
            variant="outlined"
            icon={
              data.health.redis === "up" ? (
                <CheckCircleOutlineRounded />
              ) : (
                <ErrorOutlineRounded />
              )
            }
            label={data.health.redis}
          />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Overall</CardTitle>

            {data.health.overall === "healthy" ? (
              <CheckCircleOutlineRounded />
            ) : (
              <ErrorOutlineRounded />
            )}
          </CardHeader>

          <CardValue>
            {data.health.overall === "healthy" ? "Healthy" : "Degraded"}
          </CardValue>
        </Card>
      </HealthGrid>

      <QueueGrid>
        <Card>
          <CardTitle>Jira pending</CardTitle>

          <CardValue>{data.jiraSync.pending}</CardValue>
        </Card>

        <Card>
          <CardTitle>Processing</CardTitle>

          <CardValue>{data.jiraSync.processing}</CardValue>
        </Card>

        <Card>
          <CardTitle>Completed</CardTitle>

          <CardValue>{data.jiraSync.completed}</CardValue>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Retried</CardTitle>

            <SyncRounded />
          </CardHeader>

          <CardValue>{data.jiraSync.retried}</CardValue>
        </Card>
      </QueueGrid>

      <Panel>
        <PanelHeader>
          <Primary variant="h6">Recent Jira sync errors</Primary>

          <Secondary variant="body2">
            Latest delivery jobs that encountered an error and entered retry
            flow.
          </Secondary>
        </PanelHeader>

        {data.recentErrors.length === 0 ? (
          <ErrorRow>
            <Secondary variant="body2">No recent sync errors.</Secondary>
          </ErrorRow>
        ) : (
          data.recentErrors.map((item) => (
            <ErrorRow key={item.id}>
              <Box>
                <Primary variant="body2">
                  {item.workspaceName ?? item.workspaceId}
                </Primary>

                <Secondary variant="caption">{item.sprintItemId}</Secondary>
              </Box>

              <Primary variant="body2">{item.attempts} attempts</Primary>

              <Secondary variant="body2">{item.lastError}</Secondary>

              <Secondary variant="body2">
                {formatDate(item.updatedAt)}
              </Secondary>
            </ErrorRow>
          ))
        )}
      </Panel>
    </Root>
  );
}
