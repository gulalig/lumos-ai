"use client";

import {
  ChevronLeftRounded,
  ChevronRightRounded,
  IntegrationInstructionsOutlined,
  LogoutOutlined,
  SettingsOutlined,
} from "@mui/icons-material";
import {
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
  drawerClasses,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { LumosLogo } from "@/components/brand/LumosLogo";
import type { NavigationItem } from "@/config/navigation";
import { ROUTES } from "@/constants/routes";
import { useLogoutMutation } from "@/store/api/auth.api";
import { useAppSelector } from "@/store/hooks";

const DRAWER_WIDTH = 240;

const COLLAPSED_DRAWER_WIDTH = 76;

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

interface ShellDrawerProps {
  collapsed: boolean;
}

interface NavigationLinkProps {
  active: boolean;
  collapsed: boolean;
}

const ShellRoot = styled(Box)({
  display: "flex",

  minHeight: "100vh",
});

const ShellDrawer = styled(Drawer, {
  shouldForwardProp: (prop) => prop !== "collapsed",
})<ShellDrawerProps>(({ theme, collapsed }) => ({
  width: collapsed ? COLLAPSED_DRAWER_WIDTH : DRAWER_WIDTH,

  flexShrink: 0,

  transition: theme.transitions.create("width", {
    duration: theme.transitions.duration.shorter,
  }),

  [`& .${drawerClasses.paper}`]: {
    width: collapsed ? COLLAPSED_DRAWER_WIDTH : DRAWER_WIDTH,

    boxSizing: "border-box",

    overflowX: "hidden",

    borderRight: `1px solid ${theme.palette.divider}`,

    backgroundColor: theme.palette.background.paper,

    transition: theme.transitions.create("width", {
      duration: theme.transitions.duration.shorter,
    }),
  },
}));

const DrawerLayout = styled(Box)({
  display: "flex",

  flexDirection: "column",

  width: "100%",

  height: "100%",

  minHeight: "100vh",
});

const ShellToolbar = styled(Toolbar, {
  shouldForwardProp: (prop) => prop !== "collapsed",
})<ShellDrawerProps>(({ theme, collapsed }) => ({
  display: "flex",

  alignItems: "center",

  minHeight: 64,

  paddingLeft: collapsed ? theme.spacing(2) : theme.spacing(2.5),

  paddingRight: collapsed ? theme.spacing(2) : theme.spacing(2.5),

  justifyContent: collapsed ? "center" : "flex-start",
}));

const CollapsedLogo = styled("img")({
  display: "block",

  width: 30,

  height: 30,

  objectFit: "contain",
});

const NavigationContainer = styled(Box)(({ theme }) => ({
  display: "grid",

  gap: theme.spacing(0.5),

  paddingTop: theme.spacing(2),

  paddingLeft: theme.spacing(1.5),

  paddingRight: theme.spacing(1.5),
}));

const NavigationLink = styled(Link, {
  shouldForwardProp: (prop) => prop !== "active" && prop !== "collapsed",
})<NavigationLinkProps>(({ theme, active, collapsed }) => ({
  display: "grid",

  gridTemplateColumns: collapsed ? "1fr" : "40px minmax(0, 1fr)",

  alignItems: "center",

  justifyItems: collapsed ? "center" : "stretch",

  minHeight: 44,

  paddingLeft: collapsed ? theme.spacing(1) : theme.spacing(1.5),

  paddingRight: collapsed ? theme.spacing(1) : theme.spacing(1.5),

  borderRadius: theme.shape.borderRadius,

  color: theme.palette.text.secondary,

  textDecoration: "none",

  transition: theme.transitions.create(["background-color", "color"]),

  ...(active
    ? {
        color: theme.palette.text.primary,

        backgroundColor: theme.palette.action.selected,
      }
    : {}),

  "&:hover": {
    color: theme.palette.text.primary,

    backgroundColor: theme.palette.action.hover,
  },
}));

const NavigationIcon = styled(Box, {
  shouldForwardProp: (prop) => prop !== "collapsed",
})<ShellDrawerProps>(({ collapsed }) => ({
  display: "flex",

  alignItems: "center",

  justifyContent: collapsed ? "center" : "flex-start",
}));

const NavigationLabel = styled(Typography)(({ theme }) => ({
  overflow: "hidden",

  fontWeight: theme.typography.fontWeightMedium,

  textOverflow: "ellipsis",

  whiteSpace: "nowrap",
}));

const SidebarSpacer = styled(Box)({
  flex: 1,
});

const SidebarBottom = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5),
}));

const CollapseRow = styled(Box, {
  shouldForwardProp: (prop) => prop !== "collapsed",
})<ShellDrawerProps>(({ theme, collapsed }) => ({
  display: "flex",

  justifyContent: collapsed ? "center" : "flex-end",

  paddingBottom: theme.spacing(1),
}));

const CollapseButton = styled(IconButton)(({ theme }) => ({
  width: 34,

  height: 34,

  color: theme.palette.text.secondary,

  "&:hover": {
    color: theme.palette.text.primary,

    backgroundColor: theme.palette.action.hover,
  },
}));

const UserButton = styled("button", {
  shouldForwardProp: (prop) => prop !== "collapsed",
})<ShellDrawerProps>(({ theme, collapsed }) => ({
  display: "grid",

  gridTemplateColumns: collapsed ? "1fr" : "40px minmax(0, 1fr)",

  alignItems: "center",

  width: "100%",

  minHeight: 52,

  padding: collapsed ? theme.spacing(0.75) : theme.spacing(0.75, 1),

  border: 0,

  borderRadius: theme.shape.borderRadius,

  background: "transparent",

  color: theme.palette.text.primary,

  cursor: "pointer",

  textAlign: "left",

  font: "inherit",

  "&:hover": {
    backgroundColor: theme.palette.action.hover,
  },
}));

const UserAvatar = styled(Avatar)(({ theme }) => ({
  width: 32,

  height: 32,

  fontSize: 13,

  fontWeight: theme.typography.fontWeightBold,

  color: theme.palette.text.primary,

  backgroundColor: "rgba(200, 155, 91, 0.22)",
}));

const UserDetails = styled(Box)({
  minWidth: 0,
});

const UserName = styled(Typography)(({ theme }) => ({
  overflow: "hidden",

  color: theme.palette.text.primary,

  fontWeight: theme.typography.fontWeightMedium,

  textOverflow: "ellipsis",

  whiteSpace: "nowrap",
}));

const AccountMenuHeader = styled(Box)(({ theme }) => ({
  minWidth: 220,

  padding: theme.spacing(1, 2, 1.5),
}));

const AccountMenuName = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightMedium,
}));

const AccountMenuEmail = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
}));

const LogoutMenuItem = styled(MenuItem)(({ theme }) => ({
  color: theme.palette.error.main,
}));

const ShellContent = styled(Box)(({ theme }) => ({
  flex: 1,

  minWidth: 0,

  minHeight: "100vh",

  backgroundColor: theme.palette.background.default,
}));

interface AppShellProps {
  title: string;

  navigation: NavigationItem[];

  children: ReactNode;
}

function getInitials(value: string | null | undefined): string {
  const source = value?.trim();

  if (!source) {
    return "LW";
  }

  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }

  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export function AppShell({
  title: _title,
  navigation,
  children,
}: AppShellProps) {
  const pathname = usePathname();

  const router = useRouter();

  const user = useAppSelector((state) => state.auth.user);

  const workspace = useAppSelector((state) => state.auth.workspace);

  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();

  const [collapsed, setCollapsed] = useState(false);

  const [userMenuAnchor, setUserMenuAnchor] = useState<HTMLElement | null>(
    null,
  );

  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logoutStartedRef = useRef(false);

  const workspaceName = workspace?.name?.trim() || "Lumos workspace";

  const initials = getInitials(workspaceName);

  useEffect(() => {
    const savedState = window.localStorage.getItem("lumos-sidebar-collapsed");

    if (savedState === "true") {
      setCollapsed(true);
    }
  }, []);

  const handleToggleSidebar = () => {
    setCollapsed((current) => {
      const next = !current;

      window.localStorage.setItem(
        "lumos-sidebar-collapsed",

        String(next),
      );

      return next;
    });
  };

  const handleLogout = useCallback(async () => {
    if (logoutStartedRef.current) {
      return;
    }

    logoutStartedRef.current = true;

    try {
      await logout().unwrap();
    } catch {
      // Local auth state is
      // cleared by auth.api.
    } finally {
      router.replace(ROUTES.auth.login);
    }
  }, [logout, router]);

  useEffect(() => {
    const resetInactivityTimer = () => {
      if (logoutStartedRef.current) {
        return;
      }

      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }

      inactivityTimerRef.current = setTimeout(() => {
        void handleLogout();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        resetInactivityTimer();
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "pointerdown",
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetInactivityTimer, {
        passive: true,
      });
    });

    document.addEventListener("visibilitychange", handleVisibilityChange);

    resetInactivityTimer();

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }

      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetInactivityTimer);
      });

      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [handleLogout]);

  const handleOpenUserMenu = (event: MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setUserMenuAnchor(null);
  };

  const handleNavigate = (href: string) => {
    handleCloseUserMenu();

    router.push(href);
  };

  return (
    <ShellRoot>
      <ShellDrawer variant="permanent" collapsed={collapsed}>
        <DrawerLayout>
          <ShellToolbar collapsed={collapsed}>
            {collapsed ? (
              <Link href={ROUTES.app.dashboard}>
                <CollapsedLogo src="/lumos_logo.svg" alt="Lumos" />
              </Link>
            ) : (
              <LumosLogo href={ROUTES.app.dashboard} />
            )}
          </ShellToolbar>

          <Divider />

          <NavigationContainer>
            {navigation.map((item) => {
              const Icon = item.icon;

              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              const link = (
                <NavigationLink
                  key={item.href}
                  href={item.href}
                  active={active}
                  collapsed={collapsed}
                >
                  <NavigationIcon collapsed={collapsed}>
                    <Icon fontSize="small" />
                  </NavigationIcon>

                  {!collapsed ? (
                    <NavigationLabel variant="body2">
                      {item.label}
                    </NavigationLabel>
                  ) : null}
                </NavigationLink>
              );

              if (!collapsed) {
                return link;
              }

              return (
                <Tooltip key={item.href} title={item.label} placement="right">
                  {link}
                </Tooltip>
              );
            })}
          </NavigationContainer>

          <SidebarSpacer />

          <SidebarBottom>
            <CollapseRow collapsed={collapsed}>
              <Tooltip
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                placement="right"
              >
                <CollapseButton
                  type="button"
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  onClick={handleToggleSidebar}
                >
                  {collapsed ? (
                    <ChevronRightRounded fontSize="small" />
                  ) : (
                    <ChevronLeftRounded fontSize="small" />
                  )}
                </CollapseButton>
              </Tooltip>
            </CollapseRow>

            <Divider />

            <Box>
              <UserButton
                type="button"
                collapsed={collapsed}
                onClick={handleOpenUserMenu}
              >
                <UserAvatar>{initials}</UserAvatar>

                {!collapsed ? (
                  <UserDetails>
                    <UserName variant="body2">{workspaceName}</UserName>
                  </UserDetails>
                ) : null}
              </UserButton>
            </Box>
          </SidebarBottom>
        </DrawerLayout>
      </ShellDrawer>

      <Menu
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={handleCloseUserMenu}
        anchorOrigin={{
          vertical: "top",

          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "bottom",

          horizontal: "left",
        }}
        slotProps={{
          paper: {
            style: {
              minWidth: 216,
            },
          },
        }}
      >
        <AccountMenuHeader>
          <AccountMenuName variant="body2">{workspaceName}</AccountMenuName>

          <AccountMenuEmail variant="caption">
            {user?.email ?? ""}
          </AccountMenuEmail>
        </AccountMenuHeader>

        <Divider />

        <MenuItem onClick={() => handleNavigate(ROUTES.app.integrations)}>
          <ListItemIcon>
            <IntegrationInstructionsOutlined fontSize="small" />
          </ListItemIcon>
          Integrations
        </MenuItem>

        <MenuItem onClick={() => handleNavigate(ROUTES.app.settings)}>
          <ListItemIcon>
            <SettingsOutlined fontSize="small" />
          </ListItemIcon>
          Settings
        </MenuItem>

        <Divider />

        <LogoutMenuItem
          disabled={isLoggingOut}
          onClick={() => {
            handleCloseUserMenu();

            void handleLogout();
          }}
        >
          <ListItemIcon>
            <LogoutOutlined fontSize="small" color="error" />
          </ListItemIcon>

          {isLoggingOut ? "Logging out..." : "Log out"}
        </LogoutMenuItem>
      </Menu>

      <ShellContent>{children}</ShellContent>
    </ShellRoot>
  );
}
