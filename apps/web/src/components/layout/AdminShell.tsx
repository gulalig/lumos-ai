"use client";

import {
  ChevronLeftRounded,
  ChevronRightRounded,
  LogoutRounded,
} from "@mui/icons-material";
import { Avatar, Box, IconButton, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { LumosLogo } from "@/components/brand/LumosLogo";
import type { NavigationItem } from "@/config/navigation";
import { ROUTES } from "@/constants/routes";
import { ADMIN_ACCESS_TOKEN_KEY } from "@/store/api/admin-auth.api";
import { adminBaseApi } from "@/store/api/admin-base-api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearAdminAuth } from "@/store/slices/admin-auth.slice";

interface AdminShellProps {
  children: ReactNode;

  navigation: NavigationItem[];
}

const ACCENT_DARK = "#A9793C";

const ACCENT_SOFT = "#F7F0E6";

const SIDEBAR_WIDTH = 260;

const SIDEBAR_COLLAPSED_WIDTH = 76;

const ShellRoot = styled(Box)({
  display: "flex",

  minHeight: "100vh",

  backgroundColor: "#F7F7F8",
});

interface SidebarProps {
  collapsed: boolean;
}

const Sidebar = styled(Box, {
  shouldForwardProp: (prop) => prop !== "collapsed",
})<SidebarProps>(({ theme, collapsed }) => ({
  position: "fixed",

  inset: "0 auto 0 0",

  zIndex: 20,

  display: "flex",

  flexDirection: "column",

  width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,

  borderRight: `1px solid ${theme.palette.divider}`,

  backgroundColor: theme.palette.background.paper,

  transition: theme.transitions.create("width", {
    duration: theme.transitions.duration.shorter,
  }),

  [theme.breakpoints.down("md")]: {
    width: SIDEBAR_COLLAPSED_WIDTH,
  },
}));

const BrandArea = styled(Box)(({ theme }) => ({
  display: "flex",

  alignItems: "center",

  minHeight: 76,

  paddingInline: theme.spacing(2.25),

  borderBottom: `1px solid ${theme.palette.divider}`,

  overflow: "hidden",
}));

const BrandContent = styled(Box)({
  display: "flex",

  alignItems: "center",

  gap: 12,

  minWidth: 0,
});

const AdminBadge = styled(Typography)(({ theme }) => ({
  flexShrink: 0,

  padding: "3px 7px",

  border: `1px solid ${theme.palette.divider}`,

  borderRadius: 7,

  color: theme.palette.text.secondary,

  fontSize: 9,

  fontWeight: 700,

  lineHeight: 1.3,

  textTransform: "uppercase",

  letterSpacing: "0.07em",

  whiteSpace: "nowrap",
}));

const Navigation = styled(Box)(({ theme }) => ({
  display: "grid",

  gap: theme.spacing(0.5),

  padding: theme.spacing(2.25, 1.5),
}));

interface NavigationLinkProps {
  active: boolean;

  collapsed: boolean;
}

const NavigationLink = styled(Link, {
  shouldForwardProp: (prop) => prop !== "active" && prop !== "collapsed",
})<NavigationLinkProps>(({ theme, active, collapsed }) => ({
  display: "flex",

  alignItems: "center",

  justifyContent: collapsed ? "center" : "flex-start",

  gap: theme.spacing(1.4),

  minHeight: 44,

  paddingInline: collapsed ? theme.spacing(1) : theme.spacing(1.5),

  borderRadius: 11,

  color: active ? ACCENT_DARK : theme.palette.text.secondary,

  backgroundColor: active ? ACCENT_SOFT : "transparent",

  fontSize: 14,

  fontWeight: active ? 650 : 500,

  textDecoration: "none",

  transition: theme.transitions.create(["background-color", "color"]),

  "&:hover": {
    color: ACCENT_DARK,

    backgroundColor: active ? ACCENT_SOFT : "#FAF8F4",
  },
}));

const NavigationIcon = styled(Box)({
  display: "flex",

  alignItems: "center",

  justifyContent: "center",

  flexShrink: 0,
});

const SidebarFooter = styled(Box)(({ theme }) => ({
  marginTop: "auto",

  padding: theme.spacing(1.5),

  borderTop: `1px solid ${theme.palette.divider}`,
}));

interface AdminIdentityProps {
  collapsed: boolean;
}

const AdminIdentity = styled(Box, {
  shouldForwardProp: (prop) => prop !== "collapsed",
})<AdminIdentityProps>(({ theme, collapsed }) => ({
  display: "flex",

  alignItems: "center",

  justifyContent: collapsed ? "center" : "flex-start",

  gap: theme.spacing(1.25),

  minHeight: 52,

  padding: theme.spacing(1),

  borderRadius: 12,
}));

const AdminAvatar = styled(Avatar)({
  width: 36,

  height: 36,

  flexShrink: 0,

  color: ACCENT_DARK,

  backgroundColor: ACCENT_SOFT,

  fontSize: 13,

  fontWeight: 750,
});

const AdminInfo = styled(Box)({
  minWidth: 0,

  flex: 1,
});

const AdminName = styled(Typography)(({ theme }) => ({
  overflow: "hidden",

  color: theme.palette.text.primary,

  fontSize: 13,

  fontWeight: 650,

  textOverflow: "ellipsis",

  whiteSpace: "nowrap",
}));

const AdminEmail = styled(Typography)(({ theme }) => ({
  overflow: "hidden",

  marginTop: 2,

  color: theme.palette.text.secondary,

  fontSize: 10,

  textOverflow: "ellipsis",

  whiteSpace: "nowrap",
}));

const LogoutButton = styled(IconButton)(({ theme }) => ({
  width: 34,

  height: 34,

  flexShrink: 0,

  color: theme.palette.text.secondary,

  "&:hover": {
    color: "#B23B3B",

    backgroundColor: "#FDF1F1",
  },
}));

const CollapseButton = styled(IconButton)(({ theme }) => ({
  position: "absolute",

  top: 24,

  right: -14,

  zIndex: 30,

  width: 28,

  height: 28,

  border: `1px solid ${theme.palette.divider}`,

  backgroundColor: theme.palette.background.paper,

  boxShadow: "0 3px 10px rgba(24, 24, 27, 0.06)",

  "&:hover": {
    backgroundColor: "#FAFAFB",
  },

  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}));

interface ContentProps {
  collapsed: boolean;
}

const Content = styled(Box, {
  shouldForwardProp: (prop) => prop !== "collapsed",
})<ContentProps>(({ theme, collapsed }) => ({
  width: "100%",

  minWidth: 0,

  marginLeft: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,

  transition: theme.transitions.create("margin-left", {
    duration: theme.transitions.duration.shorter,
  }),

  [theme.breakpoints.down("md")]: {
    marginLeft: SIDEBAR_COLLAPSED_WIDTH,
  },
}));

function getInitials(
  displayName: string | null | undefined,

  email: string | undefined,
): string {
  const source = displayName?.trim() || email?.split("@")[0] || "A";

  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }

  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export function AdminShell({ children, navigation }: AdminShellProps) {
  const pathname = usePathname();

  const router = useRouter();

  const dispatch = useAppDispatch();

  const admin = useAppSelector((state) => state.adminAuth.admin);

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("lumos-admin-sidebar-collapsed");

    setCollapsed(stored === "true");
  }, []);

  const handleCollapse = () => {
    setCollapsed((current) => {
      const next = !current;

      window.localStorage.setItem(
        "lumos-admin-sidebar-collapsed",

        String(next),
      );

      return next;
    });
  };

  const handleLogout = () => {
    window.localStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);

    dispatch(clearAdminAuth());

    dispatch(adminBaseApi.util.resetApiState());

    router.replace(ROUTES.admin.login);
  };

  return (
    <ShellRoot>
      <Sidebar collapsed={collapsed}>
        <BrandArea>
          {collapsed ? (
            <Box>
              <LumosLogo />
            </Box>
          ) : (
            <BrandContent>
              <LumosLogo />

              <AdminBadge>Admin</AdminBadge>
            </BrandContent>
          )}
        </BrandArea>

        <CollapseButton
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={handleCollapse}
        >
          {collapsed ? (
            <ChevronRightRounded fontSize="small" />
          ) : (
            <ChevronLeftRounded fontSize="small" />
          )}
        </CollapseButton>

        <Navigation>
          {navigation.map((item) => {
            const Icon = item.icon;

            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <NavigationLink
                key={item.href}
                href={item.href}
                active={active}
                collapsed={collapsed}
                title={collapsed ? item.label : undefined}
              >
                <NavigationIcon>
                  <Icon fontSize="small" />
                </NavigationIcon>

                {!collapsed ? <span>{item.label}</span> : null}
              </NavigationLink>
            );
          })}
        </Navigation>

        <SidebarFooter>
          <AdminIdentity collapsed={collapsed}>
            <AdminAvatar>
              {getInitials(admin?.displayName, admin?.email)}
            </AdminAvatar>

            {!collapsed ? (
              <>
                <AdminInfo>
                  <AdminName>
                    {admin?.displayName?.trim() || "Platform admin"}
                  </AdminName>

                  <AdminEmail>{admin?.email ?? ""}</AdminEmail>
                </AdminInfo>

                <LogoutButton
                  type="button"
                  aria-label="Sign out"
                  title="Sign out"
                  onClick={handleLogout}
                >
                  <LogoutRounded fontSize="small" />
                </LogoutButton>
              </>
            ) : null}
          </AdminIdentity>

          {collapsed ? (
            <LogoutButton
              type="button"
              aria-label="Sign out"
              title="Sign out"
              onClick={handleLogout}
            >
              <LogoutRounded fontSize="small" />
            </LogoutButton>
          ) : null}
        </SidebarFooter>
      </Sidebar>

      <Content collapsed={collapsed}>{children}</Content>
    </ShellRoot>
  );
}
