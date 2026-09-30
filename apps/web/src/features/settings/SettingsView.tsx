"use client";

import {
  AccountCircleOutlined,
  AdminPanelSettingsOutlined,
  ArrowForwardRounded,
  BusinessOutlined,
  EmailOutlined,
  IntegrationInstructionsOutlined,
  LockOutlined,
  LogoutRounded,
  SecurityOutlined,
} from "@mui/icons-material";
import { Alert, Avatar, Box, Button, Chip, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import Link from "next/link";
import { AppPage } from "@/components/layout/AppPage";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ROUTES } from "@/constants/routes";
import { useLogoutMutation } from "@/store/api/auth.api";
import { useAppSelector } from "@/store/hooks";

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
  maxWidth: 680,
  marginTop: theme.spacing(0.8),
  color: theme.palette.text.secondary,
  lineHeight: 1.65,
}));

const SettingsGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 330px",
  alignItems: "start",
  gap: theme.spacing(3),

  [theme.breakpoints.down("lg")]: {
    gridTemplateColumns: "1fr",
  },
}));

const Column = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(2.5),
}));

const Panel = styled(Box)(({ theme }) => ({
  overflow: "hidden",
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 18,
  backgroundColor: theme.palette.background.paper,
}));

const PanelHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: theme.spacing(2),
  padding: theme.spacing(2.5),
}));

const PanelTitleGroup = styled(Box)({
  minWidth: 0,
});

const PanelTitleRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
}));

const PanelIcon = styled(Box)({
  display: "flex",
  color: ACCENT_DARK,
});

const PanelTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 700,
}));

const PanelDescription = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.5),
  color: theme.palette.text.secondary,
  lineHeight: 1.5,
}));

const DividerLine = styled(Box)(({ theme }) => ({
  height: 1,
  backgroundColor: theme.palette.divider,
}));

const ProfileBody = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(2),
  padding: theme.spacing(2.5),

  [theme.breakpoints.down("sm")]: {
    alignItems: "flex-start",
  },
}));

const ProfileAvatar = styled(Avatar)({
  width: 58,
  height: 58,
  backgroundColor: ACCENT_SOFT,
  color: ACCENT_DARK,
  fontSize: 20,
  fontWeight: 700,
});

const ProfileCopy = styled(Box)({
  minWidth: 0,
});

const ProfileName = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 700,
}));

const ProfileEmail = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.25),
  color: theme.palette.text.secondary,
}));

const DetailList = styled(Box)({
  display: "grid",
});

const DetailRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "170px minmax(0, 1fr)",
  gap: theme.spacing(2),
  alignItems: "center",
  minHeight: 66,
  padding: theme.spacing(1.5, 2.5),
  borderTop: `1px solid ${theme.palette.divider}`,

  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
    gap: theme.spacing(0.4),
  },
}));

const DetailLabel = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(0.75),
  color: theme.palette.text.secondary,
  fontSize: 12,
  fontWeight: 600,
}));

const DetailValue = styled(Typography)(({ theme }) => ({
  overflow: "hidden",
  color: theme.palette.text.primary,
  fontWeight: 600,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}));

const WorkspaceRole = styled(Chip)({
  width: "fit-content",
  textTransform: "capitalize",
});

const SecurityBody = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(1.5),
  padding: theme.spacing(2.5),
}));

const SecurityItem = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(2),
  padding: theme.spacing(1.6),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 13,
  backgroundColor: "#FAFAFB",

  [theme.breakpoints.down("sm")]: {
    alignItems: "flex-start",
    flexDirection: "column",
  },
}));

const SecurityIdentity = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: theme.spacing(1.2),
}));

const SmallIcon = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 34,
  height: 34,
  flexShrink: 0,
  borderRadius: 10,
  color: ACCENT_DARK,
  backgroundColor: ACCENT_SOFT,
});

const SecurityTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 650,
}));

const SecurityDescription = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.25),
  color: theme.palette.text.secondary,
  lineHeight: 1.45,
}));

const ActionLink = styled(Link)(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing(0.5),
  color: ACCENT_DARK,
  fontSize: 13,
  fontWeight: 650,
  textDecoration: "none",

  "&:hover": {
    color: "#8F642E",
  },
}));

const SideCardBody = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(1.5),
  padding: theme.spacing(2.5),
}));

const InfoBox = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.7),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 13,
  backgroundColor: "#FAFAFB",
}));

const InfoLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: 11,
  fontWeight: 600,
}));

const InfoValue = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.35),
  color: theme.palette.text.primary,
  fontWeight: 650,
}));

const LogoutButton = styled(Button)(({ theme }) => ({
  justifyContent: "flex-start",
  minHeight: 42,
  color: "#B23B3B",
  borderColor: "#F0CACA",

  "&:hover": {
    borderColor: "#D98E8E",
    backgroundColor: "#FDF3F3",
  },

  [theme.breakpoints.down("lg")]: {
    width: "fit-content",
  },
}));

function initials(
  displayName: string | null | undefined,
  email: string | undefined,
): string {
  const source = displayName?.trim() || email?.split("@")[0] || "L";

  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }

  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export function SettingsView() {
  const router = useRouter();

  const user = useAppSelector((state) => state.auth.user);

  const workspace = useAppSelector((state) => state.auth.workspace);

  const [logout, { isLoading: isLoggingOut, error: logoutError }] =
    useLogoutMutation();

  const [localError, setLocalError] = useState(false);

  const displayName = user?.displayName?.trim() || "Lumos user";

  const email = user?.email || "—";

  const handleLogout = async () => {
    setLocalError(false);

    try {
      await logout().unwrap();

      router.replace(ROUTES.auth.login);
    } catch {
      setLocalError(true);
    }
  };

  return (
    <PageRoot>
      <Header>
        <PageTitle variant="h3">Settings</PageTitle>

        <PageDescription variant="body1">
          Manage your Lumos account, workspace access, security and connected
          workflow settings.
        </PageDescription>
      </Header>

      <SettingsGrid>
        <Column>
          <Panel>
            <PanelHeader>
              <PanelTitleGroup>
                <PanelTitleRow>
                  <PanelIcon>
                    <AccountCircleOutlined fontSize="small" />
                  </PanelIcon>

                  <PanelTitle variant="h6">Profile</PanelTitle>
                </PanelTitleRow>

                <PanelDescription variant="body2">
                  Your account identity used across the Lumos workspace.
                </PanelDescription>
              </PanelTitleGroup>
            </PanelHeader>

            <DividerLine />

            <ProfileBody>
              <ProfileAvatar>
                {initials(user?.displayName, user?.email)}
              </ProfileAvatar>

              <ProfileCopy>
                <ProfileName variant="h6">{displayName}</ProfileName>

                <ProfileEmail variant="body2">{email}</ProfileEmail>
              </ProfileCopy>
            </ProfileBody>

            <DetailList>
              <DetailRow>
                <DetailLabel>
                  <AccountCircleOutlined fontSize="small" />
                  Display name
                </DetailLabel>

                <DetailValue variant="body2">{displayName}</DetailValue>
              </DetailRow>

              <DetailRow>
                <DetailLabel>
                  <EmailOutlined fontSize="small" />
                  Email address
                </DetailLabel>

                <DetailValue variant="body2">{email}</DetailValue>
              </DetailRow>
            </DetailList>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitleGroup>
                <PanelTitleRow>
                  <PanelIcon>
                    <BusinessOutlined fontSize="small" />
                  </PanelIcon>

                  <PanelTitle variant="h6">Workspace</PanelTitle>
                </PanelTitleRow>

                <PanelDescription variant="body2">
                  Your current workspace membership and access role.
                </PanelDescription>
              </PanelTitleGroup>
            </PanelHeader>

            <DetailList>
              <DetailRow>
                <DetailLabel>
                  <BusinessOutlined fontSize="small" />
                  Workspace ID
                </DetailLabel>

                <DetailValue variant="body2">
                  {workspace?.workspaceId ?? "No workspace"}
                </DetailValue>
              </DetailRow>

              <DetailRow>
                <DetailLabel>
                  <AdminPanelSettingsOutlined fontSize="small" />
                  Role
                </DetailLabel>

                {workspace?.role ? (
                  <WorkspaceRole size="small" label={workspace.role} />
                ) : (
                  <DetailValue variant="body2">—</DetailValue>
                )}
              </DetailRow>

              <DetailRow>
                <DetailLabel>
                  <AccountCircleOutlined fontSize="small" />
                  Membership ID
                </DetailLabel>

                <DetailValue variant="body2">
                  {workspace?.workspaceMemberId ?? "—"}
                </DetailValue>
              </DetailRow>
            </DetailList>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitleGroup>
                <PanelTitleRow>
                  <PanelIcon>
                    <SecurityOutlined fontSize="small" />
                  </PanelIcon>

                  <PanelTitle variant="h6">Security</PanelTitle>
                </PanelTitleRow>

                <PanelDescription variant="body2">
                  Account access and password recovery options.
                </PanelDescription>
              </PanelTitleGroup>
            </PanelHeader>

            <DividerLine />

            <SecurityBody>
              <SecurityItem>
                <SecurityIdentity>
                  <SmallIcon>
                    <LockOutlined fontSize="small" />
                  </SmallIcon>

                  <Box>
                    <SecurityTitle variant="body2">Password</SecurityTitle>

                    <SecurityDescription variant="body2">
                      Use the secure password recovery flow to replace your
                      current password.
                    </SecurityDescription>
                  </Box>
                </SecurityIdentity>

                <ActionLink href={ROUTES.auth.forgotPassword}>
                  Reset password
                  <ArrowForwardRounded fontSize="small" />
                </ActionLink>
              </SecurityItem>

              <SecurityItem>
                <SecurityIdentity>
                  <SmallIcon>
                    <IntegrationInstructionsOutlined fontSize="small" />
                  </SmallIcon>

                  <Box>
                    <SecurityTitle variant="body2">
                      Connected apps
                    </SecurityTitle>

                    <SecurityDescription variant="body2">
                      Review Jira and future meeting or development integrations
                      connected to this workspace.
                    </SecurityDescription>
                  </Box>
                </SecurityIdentity>

                <ActionLink href={ROUTES.app.integrations}>
                  Manage integrations
                  <ArrowForwardRounded fontSize="small" />
                </ActionLink>
              </SecurityItem>
            </SecurityBody>
          </Panel>
        </Column>

        <Column>
          <Panel>
            <PanelHeader>
              <PanelTitleGroup>
                <PanelTitleRow>
                  <PanelIcon>
                    <SecurityOutlined fontSize="small" />
                  </PanelIcon>

                  <PanelTitle variant="h6">Session</PanelTitle>
                </PanelTitleRow>

                <PanelDescription variant="body2">
                  Current Lumos sign-in session.
                </PanelDescription>
              </PanelTitleGroup>
            </PanelHeader>

            <DividerLine />

            <SideCardBody>
              <InfoBox>
                <InfoLabel>Signed in as</InfoLabel>

                <InfoValue variant="body2">{email}</InfoValue>
              </InfoBox>

              <InfoBox>
                <InfoLabel>Workspace role</InfoLabel>

                <InfoValue variant="body2">
                  {workspace?.role
                    ? workspace.role.charAt(0).toUpperCase() +
                      workspace.role.slice(1)
                    : "No workspace"}
                </InfoValue>
              </InfoBox>

              {logoutError || localError ? (
                <Alert severity="error">
                  We couldn&apos;t sign you out cleanly. Please try again.
                </Alert>
              ) : null}

              <LogoutButton
                type="button"
                variant="outlined"
                startIcon={<LogoutRounded />}
                disabled={isLoggingOut}
                onClick={() => {
                  void handleLogout();
                }}
              >
                {isLoggingOut ? "Signing out..." : "Sign out"}
              </LogoutButton>
            </SideCardBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitleGroup>
                <PanelTitleRow>
                  <PanelIcon>
                    <BusinessOutlined fontSize="small" />
                  </PanelIcon>

                  <PanelTitle variant="h6">Workspace management</PanelTitle>
                </PanelTitleRow>

                <PanelDescription variant="body2">
                  Workspace editing will live here once the management API is
                  enabled.
                </PanelDescription>
              </PanelTitleGroup>
            </PanelHeader>

            <DividerLine />

            <SideCardBody>
              <Alert severity="info">
                Workspace name, member management and role editing are not
                exposed by the current settings API yet.
              </Alert>
            </SideCardBody>
          </Panel>
        </Column>
      </SettingsGrid>
    </PageRoot>
  );
}
