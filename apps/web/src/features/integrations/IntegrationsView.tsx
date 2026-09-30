"use client";

import {
  CheckCircleOutlineRounded,
  ErrorOutlineRounded,
  GitHub,
  IntegrationInstructionsOutlined,
  LaunchRounded,
  RefreshRounded,
  VideoCallOutlined,
  VideocamOutlined,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { useState } from "react";
import { AppPage } from "@/components/layout/AppPage";

import {
  useBeginJiraOAuthMutation,
  useGetJiraProjectsQuery,
  useGetJiraSetupQuery,
  useGetJiraSitesQuery,
  useSelectJiraProjectMutation,
  useSelectJiraSiteMutation,
} from "@/store/api/jira.api";

const ACCENT_DARK = "#A9793C";
const ACCENT_SOFT = "#F7F0E6";

const PageRoot = styled(AppPage)({});

const Header = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(3),
}));

const PageTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 750,
  letterSpacing: "-0.04em",

  [theme.breakpoints.down("sm")]: {
    fontSize: "2rem",
  },
}));

const PageDescription = styled(Typography)(({ theme }) => ({
  maxWidth: 720,
  marginTop: theme.spacing(0.8),
  color: theme.palette.text.secondary,
  lineHeight: 1.65,
}));

const IntegrationGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: theme.spacing(2.5),

  [theme.breakpoints.down("lg")]: {
    gridTemplateColumns: "1fr",
  },
}));

const IntegrationCard = styled(Box)(({ theme }) => ({
  overflow: "hidden",
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 18,
  backgroundColor: theme.palette.background.paper,
}));

const JiraIntegrationCard = styled(IntegrationCard)(({ theme }) => ({
  gridColumn: "1 / -1",

  [theme.breakpoints.down("lg")]: {
    gridColumn: "auto",
  },
}));

const IntegrationHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: theme.spacing(2),
  padding: theme.spacing(2.5),

  [theme.breakpoints.down("sm")]: {
    gap: theme.spacing(1.5),
  },
}));

const IntegrationIdentity = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
  minWidth: 0,
}));

const IntegrationIcon = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 46,
  height: 46,
  flexShrink: 0,
  borderRadius: 13,
  color: ACCENT_DARK,
  backgroundColor: ACCENT_SOFT,
});

const IntegrationText = styled(Box)({
  minWidth: 0,
});

const IntegrationName = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 700,
}));

const IntegrationDescription = styled(Typography)(({ theme }) => ({
  maxWidth: 560,
  marginTop: theme.spacing(0.25),
  color: theme.palette.text.secondary,
  lineHeight: 1.45,
}));

const StatusBadge = styled(Box)({
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  minHeight: 28,
  paddingInline: 9,
  flexShrink: 0,
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 650,
  whiteSpace: "nowrap",
});

const ConnectedBadge = styled(StatusBadge)({
  color: "#24724A",
  backgroundColor: "#EAF7EF",
});

const PendingBadge = styled(StatusBadge)({
  color: "#8A5B16",
  backgroundColor: "#FFF3DC",
});

const ErrorBadge = styled(StatusBadge)({
  color: "#B23B3B",
  backgroundColor: "#FCECEC",
});

const ComingSoonBadge = styled(StatusBadge)({
  color: "#60636B",
  backgroundColor: "#F1F1F3",
});

const DividerLine = styled(Box)(({ theme }) => ({
  height: 1,
  backgroundColor: theme.palette.divider,
}));

const IntegrationBody = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(2),
  padding: theme.spacing(2.5),
}));

const ConnectionGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: theme.spacing(1.5),

  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
  },
}));

const InfoCard = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.6),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  backgroundColor: "#FAFAFB",
}));

const InfoLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: 11,
  fontWeight: 600,
}));

const InfoValue = styled(Typography)(({ theme }) => ({
  overflow: "hidden",
  marginTop: theme.spacing(0.35),
  color: theme.palette.text.primary,
  fontWeight: 650,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}));

const Actions = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing(1),
}));

const PrimaryAction = styled(Button)({
  backgroundColor: "#171717",
  color: "#FFFFFF",
  boxShadow: "none",

  "&:hover": {
    backgroundColor: ACCENT_DARK,
    boxShadow: "none",
  },
});

const SecondaryAction = styled(Button)(({ theme }) => ({
  color: theme.palette.text.primary,
  borderColor: theme.palette.divider,

  "&:hover": {
    borderColor: ACCENT_DARK,
    backgroundColor: ACCENT_SOFT,
  },
}));

const ExternalActionLink = styled("a")(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: theme.spacing(1),
  minHeight: 36,
  paddingInline: theme.spacing(1.75),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 8,
  color: theme.palette.text.primary,
  backgroundColor: theme.palette.background.paper,
  fontSize: 14,
  fontWeight: 500,
  lineHeight: 1,
  textDecoration: "none",
  cursor: "pointer",
  transition: theme.transitions.create([
    "border-color",
    "background-color",
    "color",
  ]),

  "&:hover": {
    borderColor: ACCENT_DARK,
    color: ACCENT_DARK,
    backgroundColor: ACCENT_SOFT,
  },
}));

const SetupSection = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(1.5),
  padding: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 14,
  backgroundColor: "#FCFCFD",
}));

const SetupTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 650,
}));

const SetupDescription = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  lineHeight: 1.5,
}));

const ComingSoonBody = styled(Box)(({ theme }) => ({
  minHeight: 190,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: theme.spacing(3),
}));

const ComingSoonContent = styled(Box)({
  maxWidth: 420,
  textAlign: "center",
});

const ComingSoonIcon = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 48,
  height: 48,
  marginInline: "auto",
  marginBottom: 14,
  borderRadius: 14,
  color: ACCENT_DARK,
  backgroundColor: ACCENT_SOFT,
});

const ComingSoonTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 700,
}));

const ComingSoonText = styled(Typography)(({ theme }) => ({
  maxWidth: 360,
  marginInline: "auto",
  marginTop: theme.spacing(0.6),
  color: theme.palette.text.secondary,
  lineHeight: 1.55,
}));

const LoadingState = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 190,
});

export function IntegrationsView() {
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const {
    data: setup,
    isLoading: isSetupLoading,
    isFetching: isSetupFetching,
    error: setupError,
    refetch: refetchSetup,
  } = useGetJiraSetupQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  const [beginJiraOAuth, { isLoading: isConnecting, error: connectError }] =
    useBeginJiraOAuthMutation();

  const shouldLoadSites = setup?.state === "site_selection_required";

  const {
    data: sites = [],
    isLoading: isSitesLoading,
    error: sitesError,
  } = useGetJiraSitesQuery(undefined, {
    skip: !shouldLoadSites,
  });

  const [
    selectJiraSite,
    { isLoading: isSelectingSite, error: selectSiteError },
  ] = useSelectJiraSiteMutation();

  const shouldLoadProjects = setup?.state === "project_selection_required";

  const {
    data: projects = [],
    isLoading: isProjectsLoading,
    error: projectsError,
  } = useGetJiraProjectsQuery(undefined, {
    skip: !shouldLoadProjects,
  });

  const [
    selectJiraProject,
    { isLoading: isSelectingProject, error: selectProjectError },
  ] = useSelectJiraProjectMutation();

  const isInitialLoading = isSetupLoading || (isSetupFetching && !setup);

  const hasError =
    Boolean(setupError) ||
    Boolean(connectError) ||
    Boolean(sitesError) ||
    Boolean(selectSiteError) ||
    Boolean(projectsError) ||
    Boolean(selectProjectError);

  const handleConnectJira = async () => {
    try {
      const result = await beginJiraOAuth().unwrap();

      window.location.assign(result.url);
    } catch {
      // Error is displayed in the integration card.
    }
  };

  const handleSelectSite = async () => {
    if (!selectedSiteId) {
      return;
    }

    try {
      await selectJiraSite({
        cloudId: selectedSiteId,
      }).unwrap();

      setSelectedSiteId("");
    } catch {
      // Error is displayed in the integration card.
    }
  };

  const handleSelectProject = async () => {
    if (!selectedProjectId) {
      return;
    }

    const project = projects.find(
      (candidate) => candidate.id === selectedProjectId,
    );

    if (!project) {
      return;
    }

    try {
      await selectJiraProject({
        projectId: project.id,
        projectKey: project.key,
        projectName: project.name,
      }).unwrap();

      setSelectedProjectId("");
    } catch {
      // Error is displayed in the integration card.
    }
  };

  return (
    <PageRoot>
      <Header>
        <PageTitle variant="h3">Integrations</PageTitle>

        <PageDescription variant="body1">
          Connect the tools Lumos uses to understand meetings, coordinate
          execution and keep your existing workflow up to date.
        </PageDescription>
      </Header>

      <IntegrationGrid>
        <JiraIntegrationCard>
          <IntegrationHeader>
            <IntegrationIdentity>
              <IntegrationIcon>
                <IntegrationInstructionsOutlined />
              </IntegrationIcon>

              <IntegrationText>
                <IntegrationName variant="h6">Jira</IntegrationName>

                <IntegrationDescription variant="body2">
                  Turn commitments captured by Lumos into trackable Jira
                  execution and keep updates synchronized.
                </IntegrationDescription>
              </IntegrationText>
            </IntegrationIdentity>

            {setup?.state === "connected" ? (
              <ConnectedBadge>
                <CheckCircleOutlineRounded fontSize="inherit" />
                Connected
              </ConnectedBadge>
            ) : setup?.lastError || hasError ? (
              <ErrorBadge>
                <ErrorOutlineRounded fontSize="inherit" />
                Needs attention
              </ErrorBadge>
            ) : (
              <PendingBadge>Setup required</PendingBadge>
            )}
          </IntegrationHeader>

          <DividerLine />

          {isInitialLoading ? (
            <LoadingState>
              <CircularProgress size={28} />
            </LoadingState>
          ) : (
            <IntegrationBody>
              {setupError ? (
                <Alert severity="error">
                  We couldn&apos;t load your Jira integration status.
                </Alert>
              ) : null}

              {setup?.lastError ? (
                <Alert severity="error">{setup.lastError}</Alert>
              ) : null}

              {connectError ? (
                <Alert severity="error">
                  We couldn&apos;t start the Jira connection. Please try again.
                </Alert>
              ) : null}

              {sitesError ? (
                <Alert severity="error">
                  We couldn&apos;t load your Atlassian sites.
                </Alert>
              ) : null}

              {selectSiteError ? (
                <Alert severity="error">
                  We couldn&apos;t save the selected Atlassian site.
                </Alert>
              ) : null}

              {projectsError ? (
                <Alert severity="error">
                  We couldn&apos;t load your Jira projects.
                </Alert>
              ) : null}

              {selectProjectError ? (
                <Alert severity="error">
                  We couldn&apos;t connect this Jira project.
                </Alert>
              ) : null}

              {setup?.state === "connected" ? (
                <>
                  <ConnectionGrid>
                    <InfoCard>
                      <InfoLabel>Atlassian site</InfoLabel>

                      <InfoValue variant="body2">
                        {setup.site?.name ?? "Connected site"}
                      </InfoValue>
                    </InfoCard>

                    <InfoCard>
                      <InfoLabel>Jira project</InfoLabel>

                      <InfoValue variant="body2">
                        {setup.project
                          ? `${setup.project.key} · ${setup.project.name}`
                          : "Connected project"}
                      </InfoValue>
                    </InfoCard>
                  </ConnectionGrid>

                  <Alert severity="success">
                    Jira delivery is active. Lumos can synchronize execution
                    items with the selected project.
                  </Alert>

                  <Actions>
                    {setup.site?.url ? (
                      <ExternalActionLink
                        href={setup.site.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <LaunchRounded fontSize="small" />
                        Open Jira
                      </ExternalActionLink>
                    ) : null}

                    <SecondaryAction
                      type="button"
                      variant="outlined"
                      startIcon={<RefreshRounded />}
                      disabled={isSetupFetching}
                      onClick={() => {
                        void refetchSetup();
                      }}
                    >
                      Refresh status
                    </SecondaryAction>
                  </Actions>
                </>
              ) : null}

              {setup?.state === "authorization_required" ? (
                <SetupSection>
                  <SetupTitle variant="body1">
                    Connect your Atlassian account
                  </SetupTitle>

                  <SetupDescription variant="body2">
                    Authorize Lumos so it can access the Jira sites and projects
                    available to your workspace.
                  </SetupDescription>

                  <Actions>
                    <PrimaryAction
                      type="button"
                      variant="contained"
                      disabled={isConnecting}
                      onClick={() => {
                        void handleConnectJira();
                      }}
                    >
                      {isConnecting ? "Connecting..." : "Connect Jira"}
                    </PrimaryAction>
                  </Actions>
                </SetupSection>
              ) : null}

              {setup?.state === "site_selection_required" ? (
                <SetupSection>
                  <SetupTitle variant="body1">
                    Choose your Atlassian site
                  </SetupTitle>

                  <SetupDescription variant="body2">
                    Select the Atlassian site Lumos should use for Jira
                    execution delivery.
                  </SetupDescription>

                  <FormControl fullWidth size="small">
                    <InputLabel id="jira-site-label">Atlassian site</InputLabel>

                    <Select
                      labelId="jira-site-label"
                      label="Atlassian site"
                      value={selectedSiteId}
                      disabled={isSitesLoading || isSelectingSite}
                      onChange={(event) => {
                        setSelectedSiteId(event.target.value);
                      }}
                    >
                      {sites.map((site) => (
                        <MenuItem key={site.id} value={site.id}>
                          {site.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Actions>
                    <PrimaryAction
                      type="button"
                      variant="contained"
                      disabled={!selectedSiteId || isSelectingSite}
                      onClick={() => {
                        void handleSelectSite();
                      }}
                    >
                      {isSelectingSite ? "Saving..." : "Continue"}
                    </PrimaryAction>
                  </Actions>
                </SetupSection>
              ) : null}

              {setup?.state === "project_selection_required" ? (
                <SetupSection>
                  <SetupTitle variant="body1">Choose a Jira project</SetupTitle>

                  <SetupDescription variant="body2">
                    Execution items created by Lumos will sync into the selected
                    Jira project.
                  </SetupDescription>

                  {setup.site ? (
                    <InfoCard>
                      <InfoLabel>Selected site</InfoLabel>

                      <InfoValue variant="body2">{setup.site.name}</InfoValue>
                    </InfoCard>
                  ) : null}

                  <FormControl fullWidth size="small">
                    <InputLabel id="jira-project-label">
                      Jira project
                    </InputLabel>

                    <Select
                      labelId="jira-project-label"
                      label="Jira project"
                      value={selectedProjectId}
                      disabled={isProjectsLoading || isSelectingProject}
                      onChange={(event) => {
                        setSelectedProjectId(event.target.value);
                      }}
                    >
                      {projects.map((project) => (
                        <MenuItem key={project.id} value={project.id}>
                          {project.key} · {project.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Actions>
                    <PrimaryAction
                      type="button"
                      variant="contained"
                      disabled={!selectedProjectId || isSelectingProject}
                      onClick={() => {
                        void handleSelectProject();
                      }}
                    >
                      {isSelectingProject ? "Connecting..." : "Connect project"}
                    </PrimaryAction>
                  </Actions>
                </SetupSection>
              ) : null}
            </IntegrationBody>
          )}
        </JiraIntegrationCard>

        <IntegrationCard>
          <IntegrationHeader>
            <IntegrationIdentity>
              <IntegrationIcon>
                <VideocamOutlined />
              </IntegrationIcon>

              <IntegrationText>
                <IntegrationName variant="h6">Zoom</IntegrationName>

                <IntegrationDescription variant="body2">
                  Let Lumos join and process Zoom meetings through the same
                  intelligence pipeline.
                </IntegrationDescription>
              </IntegrationText>
            </IntegrationIdentity>

            <ComingSoonBadge>Coming soon</ComingSoonBadge>
          </IntegrationHeader>

          <DividerLine />

          <ComingSoonBody>
            <ComingSoonContent>
              <ComingSoonIcon>
                <VideocamOutlined />
              </ComingSoonIcon>

              <ComingSoonTitle variant="body1">
                Zoom integration
              </ComingSoonTitle>

              <ComingSoonText variant="body2">
                Capture Zoom conversations, extract commitments and keep the
                same Lumos execution workflow.
              </ComingSoonText>
            </ComingSoonContent>
          </ComingSoonBody>
        </IntegrationCard>

        <IntegrationCard>
          <IntegrationHeader>
            <IntegrationIdentity>
              <IntegrationIcon>
                <VideoCallOutlined />
              </IntegrationIcon>

              <IntegrationText>
                <IntegrationName variant="h6">Google Meet</IntegrationName>

                <IntegrationDescription variant="body2">
                  Bring Google Meet conversations into Lumos for live
                  understanding and follow-through.
                </IntegrationDescription>
              </IntegrationText>
            </IntegrationIdentity>

            <ComingSoonBadge>Coming soon</ComingSoonBadge>
          </IntegrationHeader>

          <DividerLine />

          <ComingSoonBody>
            <ComingSoonContent>
              <ComingSoonIcon>
                <VideoCallOutlined />
              </ComingSoonIcon>

              <ComingSoonTitle variant="body1">
                Google Meet integration
              </ComingSoonTitle>

              <ComingSoonText variant="body2">
                Lumos will process Google Meet conversations and turn important
                outcomes into accountable execution.
              </ComingSoonText>
            </ComingSoonContent>
          </ComingSoonBody>
        </IntegrationCard>

        <IntegrationCard>
          <IntegrationHeader>
            <IntegrationIdentity>
              <IntegrationIcon>
                <GitHub />
              </IntegrationIcon>

              <IntegrationText>
                <IntegrationName variant="h6">GitHub</IntegrationName>

                <IntegrationDescription variant="body2">
                  Connect engineering execution and development activity with
                  decisions made during meetings.
                </IntegrationDescription>
              </IntegrationText>
            </IntegrationIdentity>

            <ComingSoonBadge>Coming soon</ComingSoonBadge>
          </IntegrationHeader>

          <DividerLine />

          <ComingSoonBody>
            <ComingSoonContent>
              <ComingSoonIcon>
                <GitHub />
              </ComingSoonIcon>

              <ComingSoonTitle variant="body1">
                GitHub integration
              </ComingSoonTitle>

              <ComingSoonText variant="body2">
                Link meeting commitments with repositories, issues and
                engineering delivery without losing the original meeting
                context.
              </ComingSoonText>
            </ComingSoonContent>
          </ComingSoonBody>
        </IntegrationCard>
      </IntegrationGrid>
    </PageRoot>
  );
}
