"use client";

import {
  CheckCircleRounded,
  CloseRounded,
  ErrorOutlineRounded,
  LinkRounded,
} from "@mui/icons-material";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  IconButton,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { useRouter } from "next/navigation";

import { ROUTES } from "@/constants/routes";
import { useGetJiraSetupQuery } from "@/store/api/jira.api";
import { useAppSelector } from "@/store/hooks";

const BRAND = "#C89B5B";
const BRAND_DARK = "#A9793C";
const BRAND_SOFT = "#F7F0E6";

interface DemoEntryDialogProps {
  open: boolean;
  onClose: () => void;
}

const DialogSurface = styled(Box)(({ theme }) => ({
  position: "relative",
  width: "100%",
  maxWidth: 500,
  padding: theme.spacing(4),
  backgroundColor: theme.palette.background.paper,
}));

const CloseButton = styled(IconButton)({
  position: "absolute",
  top: 14,
  right: 14,
});

const IconBox = styled(Box)({
  display: "grid",
  width: 50,
  height: 50,
  placeItems: "center",
  marginBottom: 20,
  borderRadius: 14,
  backgroundColor: BRAND_SOFT,
  color: BRAND_DARK,
});

const Title = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: 26,
  fontWeight: 720,
  letterSpacing: "-0.03em",
}));

const Description = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(1),
  color: theme.palette.text.secondary,
  lineHeight: 1.7,
}));

const Requirements = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(1.2),
  marginTop: theme.spacing(3),
}));

const Requirement = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.2),
  padding: theme.spacing(1.5),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
}));

const RequirementText = styled(Typography)({
  fontSize: 13,
  fontWeight: 650,
});

const Actions = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  marginTop: theme.spacing(3),
}));

const PrimaryButton = styled(Button)({
  minHeight: 42,
  paddingInline: 18,
  borderRadius: 10,
  backgroundColor: BRAND,
  color: "#FFFFFF",
  textTransform: "none",
  fontWeight: 700,

  "&:hover": {
    backgroundColor: BRAND_DARK,
  },
});

const SecondaryButton = styled(Button)(({ theme }) => ({
  minHeight: 42,
  paddingInline: 18,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 10,
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  textTransform: "none",
  fontWeight: 650,
}));

const LoadingArea = styled(Box)({
  display: "grid",
  minHeight: 180,
  placeItems: "center",
});

export function DemoEntryDialog({ open, onClose }: DemoEntryDialogProps) {
  const router = useRouter();

  const accessToken = useAppSelector((state) => state.auth.accessToken);

  const workspace = useAppSelector((state) => state.auth.workspace);

  const {
    data: jiraSetup,
    isLoading,
    isError,
    refetch,
  } = useGetJiraSetupQuery(undefined, {
    skip: !open || !accessToken || !workspace,
  });

  const goToLogin = () => {
    router.push(
      `${ROUTES.auth.login}?next=${encodeURIComponent(ROUTES.app.demo)}`,
    );
  };

  const goToSignup = () => {
    router.push(ROUTES.auth.signup);
  };

  const goToWorkspaceSetup = () => {
    router.push(ROUTES.onboarding.workspace);
  };

  const goToIntegrations = () => {
    router.push(ROUTES.app.integrations);
  };

  const startDemo = () => {
    onClose();

    router.push(ROUTES.app.demo);
  };

  let content: React.ReactNode;

  if (!accessToken) {
    content = (
      <>
        <IconBox>
          <ErrorOutlineRounded />
        </IconBox>

        <Title>Sign in to try Lumos</Title>

        <Description>
          The live demo uses your microphone, workspace and connected Jira
          project.
        </Description>

        <Actions>
          <PrimaryButton onClick={goToLogin}>Sign in</PrimaryButton>

          <SecondaryButton onClick={goToSignup}>Create account</SecondaryButton>
        </Actions>
      </>
    );
  } else if (!workspace) {
    content = (
      <>
        <IconBox>
          <ErrorOutlineRounded />
        </IconBox>

        <Title>Finish your workspace setup</Title>

        <Description>
          Lumos needs a workspace before a live meeting can be created.
        </Description>

        <Actions>
          <PrimaryButton onClick={goToWorkspaceSetup}>
            Continue setup
          </PrimaryButton>
        </Actions>
      </>
    );
  } else if (isLoading) {
    content = (
      <LoadingArea>
        <CircularProgress size={30} />
      </LoadingArea>
    );
  } else if (isError) {
    content = (
      <>
        <IconBox>
          <ErrorOutlineRounded />
        </IconBox>

        <Title>We couldn&apos;t check Jira</Title>

        <Description>
          Lumos couldn&apos;t verify your Jira connection.
        </Description>

        <Actions>
          <PrimaryButton onClick={() => void refetch()}>
            Try again
          </PrimaryButton>
        </Actions>
      </>
    );
  } else if (jiraSetup?.state !== "connected") {
    content = (
      <>
        <IconBox>
          <LinkRounded />
        </IconBox>

        <Title>Connect Jira first</Title>

        <Description>
          The demo creates execution items from real meeting commitments, so
          Jira must be connected before you start.
        </Description>

        <Requirements>
          <Requirement>
            <CheckCircleRounded
              fontSize="small"
              htmlColor={jiraSetup?.site ? "#477A57" : "#B5B5B5"}
            />

            <RequirementText>Atlassian site connected</RequirementText>
          </Requirement>

          <Requirement>
            <CheckCircleRounded
              fontSize="small"
              htmlColor={jiraSetup?.project ? "#477A57" : "#B5B5B5"}
            />

            <RequirementText>Jira project selected</RequirementText>
          </Requirement>
        </Requirements>

        <Actions>
          <PrimaryButton onClick={goToIntegrations}>Connect Jira</PrimaryButton>
        </Actions>
      </>
    );
  } else {
    content = (
      <>
        <IconBox>
          <CheckCircleRounded />
        </IconBox>

        <Title>Ready for the live demo</Title>

        <Description>
          Your workspace and Jira project are connected. Start the demo and
          speak naturally — Lumos will listen, identify commitments and turn
          resolved work into execution.
        </Description>

        <Actions>
          <PrimaryButton onClick={startDemo}>Start live demo</PrimaryButton>
        </Actions>
      </>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      slotProps={{
        paper: {
          style: {
            borderRadius: 20,
            overflow: "hidden",
          },
        },
      }}
    >
      <DialogSurface>
        <CloseButton type="button" aria-label="Close" onClick={onClose}>
          <CloseRounded fontSize="small" />
        </CloseButton>

        {content}
      </DialogSurface>
    </Dialog>
  );
}
