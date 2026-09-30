"use client";

import {
  ApartmentOutlined,
  CheckCircleOutlineRounded,
  GroupsOutlined,
  MeetingRoomOutlined,
  PersonAddAltOutlined,
  SyncRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  CircularProgress,
  Button,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";

import { AppPage } from "@/components/layout/AppPage";
import { useGetAdminOverviewQuery } from "@/store/api/admin-overview.api";

const ACCENT_DARK = "#A9793C";
const ACCENT_SOFT = "#F7F0E6";

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
  maxWidth: 720,
  marginTop: theme.spacing(0.75),
  color: theme.palette.text.secondary,
  lineHeight: 1.6,
}));

const SummaryGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
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
  minHeight: 138,
  padding: theme.spacing(2.4),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 18,
  backgroundColor: theme.palette.background.paper,
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
  width: 38,
  height: 38,
  borderRadius: 11,
  color: ACCENT_DARK,
  backgroundColor: ACCENT_SOFT,
});

const SummaryValue = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(2),
  color: theme.palette.text.primary,
  fontSize: 31,
  fontWeight: 750,
  lineHeight: 1,
  letterSpacing: "-0.04em",
}));

const SummaryHint = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.9),
  color: theme.palette.text.secondary,
  fontSize: 12,
}));

const MainGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: theme.spacing(3),

  [theme.breakpoints.down("lg")]: {
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

const PanelTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 700,
}));

const PanelDescription = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.45),
  color: theme.palette.text.secondary,
}));

const Row = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(2),
  minHeight: 68,
  padding: theme.spacing(1.45, 2.5),
  borderTop: `1px solid ${theme.palette.divider}`,
}));

const RowMain = styled(Box)({
  minWidth: 0,
});

const RowTitle = styled(Typography)(({ theme }) => ({
  overflow: "hidden",
  color: theme.palette.text.primary,
  fontWeight: 650,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}));

const RowMeta = styled(Typography)(({ theme }) => ({
  display: "block",
  marginTop: 3,
  color: theme.palette.text.secondary,
}));

const CountBadge = styled(Box)({
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  paddingInline: 10,
  flexShrink: 0,
  borderRadius: 999,
  color: ACCENT_DARK,
  backgroundColor: ACCENT_SOFT,
  fontSize: 11,
  fontWeight: 700,
});

const JiraGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: theme.spacing(1.2),
  padding: theme.spacing(2.5),
  borderTop: `1px solid ${theme.palette.divider}`,

  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
  },
}));

const JiraStat = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  backgroundColor: "#FAFAFB",
}));

const JiraValue = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: 22,
  fontWeight: 750,
}));

const JiraLabel = styled(Typography)(({ theme }) => ({
  marginTop: 2,
  color: theme.palette.text.secondary,
  fontSize: 11,
}));

const Loading = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 520,
});

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function AdminOverview() {
  const { data, isLoading, error, refetch } = useGetAdminOverviewQuery();

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
          Unable to load the admin overview.
        </Alert>
      </Root>
    );
  }

  return (
    <Root>
      <Header>
        <Title variant="h3">Platform overview</Title>

        <Description variant="body1">
          Monitor Lumos accounts, workspace activity and integration health
          across the platform.
        </Description>
      </Header>

      <SummaryGrid>
        <SummaryCard>
          <SummaryHeader>
            <SummaryLabel variant="body2">Total users</SummaryLabel>

            <SummaryIcon>
              <GroupsOutlined fontSize="small" />
            </SummaryIcon>
          </SummaryHeader>

          <SummaryValue>{data.summary.totalUsers}</SummaryValue>

          <SummaryHint>Registered Lumos accounts</SummaryHint>
        </SummaryCard>

        <SummaryCard>
          <SummaryHeader>
            <SummaryLabel variant="body2">Workspaces</SummaryLabel>

            <SummaryIcon>
              <ApartmentOutlined fontSize="small" />
            </SummaryIcon>
          </SummaryHeader>

          <SummaryValue>{data.summary.totalWorkspaces}</SummaryValue>

          <SummaryHint>Organizations created</SummaryHint>
        </SummaryCard>

        <SummaryCard>
          <SummaryHeader>
            <SummaryLabel variant="body2">Active workspaces</SummaryLabel>

            <SummaryIcon>
              <CheckCircleOutlineRounded fontSize="small" />
            </SummaryIcon>
          </SummaryHeader>

          <SummaryValue>{data.summary.activeWorkspaces}</SummaryValue>

          <SummaryHint>Had meeting activity in the last 30 days</SummaryHint>
        </SummaryCard>

        <SummaryCard>
          <SummaryHeader>
            <SummaryLabel variant="body2">Meetings</SummaryLabel>

            <SummaryIcon>
              <MeetingRoomOutlined fontSize="small" />
            </SummaryIcon>
          </SummaryHeader>

          <SummaryValue>{data.summary.totalMeetings}</SummaryValue>

          <SummaryHint>Meetings processed across Lumos</SummaryHint>
        </SummaryCard>

        <SummaryCard>
          <SummaryHeader>
            <SummaryLabel variant="body2">Jira connected</SummaryLabel>

            <SummaryIcon>
              <SyncRounded fontSize="small" />
            </SummaryIcon>
          </SummaryHeader>

          <SummaryValue>{data.summary.jiraConnectedWorkspaces}</SummaryValue>

          <SummaryHint>Workspaces with active Jira delivery</SummaryHint>
        </SummaryCard>

        <SummaryCard>
          <SummaryHeader>
            <SummaryLabel variant="body2">New users</SummaryLabel>

            <SummaryIcon>
              <PersonAddAltOutlined fontSize="small" />
            </SummaryIcon>
          </SummaryHeader>

          <SummaryValue>{data.summary.recentSignups}</SummaryValue>

          <SummaryHint>Registered in the last 7 days</SummaryHint>
        </SummaryCard>
      </SummaryGrid>

      <MainGrid>
        <Panel>
          <PanelHeader>
            <PanelTitle variant="h6">Recent users</PanelTitle>

            <PanelDescription variant="body2">
              Latest accounts registered on the platform.
            </PanelDescription>
          </PanelHeader>

          {data.recentUsers.map((user) => (
            <Row key={user.id}>
              <RowMain>
                <RowTitle variant="body2">{user.displayName}</RowTitle>

                <RowMeta variant="caption">
                  {user.email} · {formatDate(user.createdAt)}
                </RowMeta>
              </RowMain>
            </Row>
          ))}
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle variant="h6">Recent workspaces</PanelTitle>

            <PanelDescription variant="body2">
              Latest organizations created in Lumos.
            </PanelDescription>
          </PanelHeader>

          {data.recentWorkspaces.map((workspace) => (
            <Row key={workspace.id}>
              <RowMain>
                <RowTitle variant="body2">{workspace.name}</RowTitle>

                <RowMeta variant="caption">
                  {workspace.slug} · {formatDate(workspace.createdAt)}
                </RowMeta>
              </RowMain>

              <CountBadge>
                {workspace.memberCount} member
                {workspace.memberCount === 1 ? "" : "s"}
              </CountBadge>
            </Row>
          ))}
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle variant="h6">Jira integration health</PanelTitle>

            <PanelDescription variant="body2">
              Current Atlassian connection states across workspaces.
            </PanelDescription>
          </PanelHeader>

          <JiraGrid>
            <JiraStat>
              <JiraValue>{data.jira.connected}</JiraValue>

              <JiraLabel>Connected</JiraLabel>
            </JiraStat>

            <JiraStat>
              <JiraValue>{data.jira.pending}</JiraValue>

              <JiraLabel>Setup pending</JiraLabel>
            </JiraStat>

            <JiraStat>
              <JiraValue>{data.jira.error}</JiraValue>

              <JiraLabel>Error</JiraLabel>
            </JiraStat>
          </JiraGrid>
        </Panel>
      </MainGrid>
    </Root>
  );
}
