"use client";

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
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  useBeginJiraOAuthMutation,
  useGetJiraProjectsQuery,
  useGetJiraSetupQuery,
  useGetJiraSitesQuery,
  useSelectJiraProjectMutation,
  useSelectJiraSiteMutation,
} from "@/store/api/jira.api";

import { ROUTES } from "@/constants/routes";

const Header = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(1),
  marginBottom: theme.spacing(4),
}));

const Title = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
  letterSpacing: "-0.04em",
}));

const Description = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  lineHeight: 1.7,
}));

const IntegrationCard = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(3),
  padding: theme.spacing(3),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
}));

const IntegrationHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(2),
}));

const JiraIcon = styled(Box)(({ theme }) => ({
  display: "flex",
  width: 48,
  height: 48,
  alignItems: "center",
  justifyContent: "center",
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  fontWeight: theme.typography.fontWeightBold,
}));

const IntegrationInfo = styled(Box)({
  display: "grid",
  gap: 2,
});

const IntegrationName = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
}));

const IntegrationDescription = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
}));

const Actions = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(1.5),
}));

export function IntegrationOnboarding() {
  const router = useRouter();

  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const {
    data: setup,
    isLoading: isSetupLoading,
    isFetching: isSetupFetching,
    error: setupError,
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

  const handleSkip = () => {
    router.replace(ROUTES.app.dashboard);
  };

  const handleContinue = () => {
    router.replace(ROUTES.app.dashboard);
  };

  const handleConnectJira = async () => {
    try {
      const result = await beginJiraOAuth().unwrap();

      window.location.assign(result.url);
    } catch {
      // Error is rendered below.
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
    } catch {
      // Error is rendered below.
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
    } catch {
      // Error is rendered below.
    }
  };

  const isInitialLoading = isSetupLoading || (isSetupFetching && !setup);

  return (
    <>
      <Header>
        <Title variant="h3">Connect your tools</Title>

        <Description variant="body1">
          Connect Jira to keep meeting commitments connected to the work your
          team already manages.
        </Description>
      </Header>

      <IntegrationCard>
        <IntegrationHeader>
          <JiraIcon>J</JiraIcon>

          <IntegrationInfo>
            <IntegrationName variant="h6">Jira</IntegrationName>

            <IntegrationDescription variant="body2">
              Sync resolved commitments with your Jira project.
            </IntegrationDescription>
          </IntegrationInfo>
        </IntegrationHeader>

        {isInitialLoading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              py: 3,
            }}
          >
            <CircularProgress size={28} />
          </Box>
        ) : null}

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
            We couldn&apos;t select this Atlassian site.
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

        {setup?.state === "authorization_required" ? (
          <Actions>
            <Button
              type="button"
              variant="contained"
              disabled={isConnecting}
              onClick={() => {
                void handleConnectJira();
              }}
            >
              {isConnecting ? "Connecting..." : "Connect Jira"}
            </Button>

            <Button type="button" variant="text" onClick={handleSkip}>
              Skip for now
            </Button>
          </Actions>
        ) : null}

        {setup?.state === "site_selection_required" ? (
          <Actions>
            <Typography variant="body2">
              Choose the Atlassian site you want to connect.
            </Typography>

            {isSitesLoading ? (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  py: 2,
                }}
              >
                <CircularProgress size={24} />
              </Box>
            ) : (
              <FormControl fullWidth>
                <InputLabel id="jira-site-label">Atlassian site</InputLabel>

                <Select
                  labelId="jira-site-label"
                  label="Atlassian site"
                  value={selectedSiteId}
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
            )}

            <Button
              type="button"
              variant="contained"
              disabled={!selectedSiteId || isSelectingSite || isSitesLoading}
              onClick={() => {
                void handleSelectSite();
              }}
            >
              {isSelectingSite ? "Saving..." : "Continue"}
            </Button>
          </Actions>
        ) : null}

        {setup?.state === "project_selection_required" ? (
          <Actions>
            {setup.site ? (
              <Alert severity="success">
                Connected to {setup.site.name ?? "Atlassian"}.
              </Alert>
            ) : null}

            <Typography variant="body2">
              Choose the Jira project Lumos should use.
            </Typography>

            {isProjectsLoading ? (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  py: 2,
                }}
              >
                <CircularProgress size={24} />
              </Box>
            ) : (
              <FormControl fullWidth>
                <InputLabel id="jira-project-label">Jira project</InputLabel>

                <Select
                  labelId="jira-project-label"
                  label="Jira project"
                  value={selectedProjectId}
                  onChange={(event) => {
                    setSelectedProjectId(event.target.value);
                  }}
                >
                  {projects.map((project) => (
                    <MenuItem key={project.id} value={project.id}>
                      {project.name} ({project.key})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <Button
              type="button"
              variant="contained"
              disabled={
                !selectedProjectId || isSelectingProject || isProjectsLoading
              }
              onClick={() => {
                void handleSelectProject();
              }}
            >
              {isSelectingProject ? "Connecting..." : "Connect project"}
            </Button>
          </Actions>
        ) : null}

        {setup?.state === "connected" ? (
          <Actions>
            <Alert severity="success">
              Jira is connected
              {setup.project
                ? ` to ${setup.project.name} (${setup.project.key}).`
                : "."}
            </Alert>

            <Button type="button" variant="contained" onClick={handleContinue}>
              Continue to dashboard
            </Button>
          </Actions>
        ) : null}
      </IntegrationCard>
    </>
  );
}
