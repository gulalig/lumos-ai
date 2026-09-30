"use client";

import {
  CheckCircleRounded,
  ErrorOutlineRounded,
  LinkRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { ROUTES } from "@/constants/routes";
import { useGetJiraSetupQuery } from "@/store/api/jira.api";
import { useAppSelector } from "@/store/hooks";

const BRAND = "#C89B5B";
const BRAND_DARK = "#A9793C";
const BRAND_SOFT = "#F7F0E6";

interface DemoPrerequisiteGateProps {
  children: ReactNode;
}

const Center = styled(Box)(({ theme }) => ({
  display: "grid",
  minHeight: "calc(100vh - 72px)",
  placeItems: "center",
  padding: theme.spacing(4),
}));

const GateCard = styled(Box)(({ theme }) => ({
  width: "100%",
  maxWidth: 560,
  padding: theme.spacing(4),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 20,
  backgroundColor: theme.palette.background.paper,
  boxShadow: "0 20px 50px rgba(30, 24, 18, 0.07)",
}));

const GateIcon = styled(Box)({
  display: "grid",
  width: 52,
  height: 52,
  placeItems: "center",
  marginBottom: 20,
  borderRadius: 14,
  backgroundColor: BRAND_SOFT,
  color: BRAND_DARK,
});

const GateTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: 26,
  fontWeight: 720,
  letterSpacing: "-0.03em",
}));

const GateDescription = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(1),
  color: theme.palette.text.secondary,
  lineHeight: 1.7,
}));

const RequirementList = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(1.5),
  marginTop: theme.spacing(3),
}));

const Requirement = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.2),
  padding: theme.spacing(1.5),
  borderRadius: 12,
  backgroundColor: "#FAFAFA",
}));

const RequirementText = styled(Typography)({
  fontSize: 13,
  fontWeight: 600,
});

const ActionRow = styled(Box)(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(1),
  marginTop: theme.spacing(3),
}));

const PrimaryButton = styled(Button)({
  minHeight: 42,
  borderRadius: 10,
  backgroundColor: BRAND,
  color: "#FFFFFF",
  textTransform: "none",
  fontWeight: 700,

  "&:hover": {
    backgroundColor: BRAND_DARK,
  },
});

export function DemoPrerequisiteGate({ children }: DemoPrerequisiteGateProps) {
  const router = useRouter();

  const accessToken = useAppSelector((state) => state.auth.accessToken);

  const workspace = useAppSelector((state) => state.auth.workspace);

  const {
    data: jiraSetup,
    isLoading: jiraLoading,
    isError: jiraError,
    refetch,
  } = useGetJiraSetupQuery(undefined, {
    skip: !accessToken || !workspace,
  });

  if (!accessToken) {
    return (
      <Center>
        <GateCard>
          <GateIcon>
            <ErrorOutlineRounded />
          </GateIcon>

          <GateTitle>Sign in to run the demo</GateTitle>

          <GateDescription>
            The Lumos demo uses a real workspace, microphone access and
            connected integrations.
          </GateDescription>

          <ActionRow>
            <PrimaryButton
              onClick={() =>
                router.push(
                  `${ROUTES.auth.login}?next=${encodeURIComponent(
                    ROUTES.app.demo,
                  )}`,
                )
              }
            >
              Sign in
            </PrimaryButton>
          </ActionRow>
        </GateCard>
      </Center>
    );
  }

  if (!workspace) {
    return (
      <Center>
        <GateCard>
          <GateIcon>
            <ErrorOutlineRounded />
          </GateIcon>

          <GateTitle>Finish workspace setup</GateTitle>

          <GateDescription>
            Create your Lumos workspace before starting the live demo.
          </GateDescription>

          <ActionRow>
            <PrimaryButton
              onClick={() => router.push(ROUTES.onboarding.workspace)}
            >
              Continue setup
            </PrimaryButton>
          </ActionRow>
        </GateCard>
      </Center>
    );
  }

  if (jiraLoading) {
    return (
      <Center>
        <CircularProgress size={30} />
      </Center>
    );
  }

  if (jiraError) {
    return (
      <Center>
        <GateCard>
          <Alert severity="error">Unable to verify your Jira connection.</Alert>

          <ActionRow>
            <PrimaryButton onClick={() => void refetch()}>Retry</PrimaryButton>
          </ActionRow>
        </GateCard>
      </Center>
    );
  }

  if (jiraSetup?.state !== "connected") {
    return (
      <Center>
        <GateCard>
          <GateIcon>
            <LinkRounded />
          </GateIcon>

          <GateTitle>Connect Jira to continue</GateTitle>

          <GateDescription>
            The demo creates real execution items from meeting commitments, so a
            Jira project must be connected first.
          </GateDescription>

          <RequirementList>
            <Requirement>
              <CheckCircleRounded
                fontSize="small"
                htmlColor={jiraSetup?.site ? "#477A57" : "#B0B0B0"}
              />

              <RequirementText>Atlassian site connected</RequirementText>
            </Requirement>

            <Requirement>
              <CheckCircleRounded
                fontSize="small"
                htmlColor={jiraSetup?.project ? "#477A57" : "#B0B0B0"}
              />

              <RequirementText>Jira project selected</RequirementText>
            </Requirement>
          </RequirementList>

          <ActionRow>
            <PrimaryButton onClick={() => router.push(ROUTES.app.integrations)}>
              Connect Jira
            </PrimaryButton>
          </ActionRow>
        </GateCard>
      </Center>
    );
  }

  return children;
}
