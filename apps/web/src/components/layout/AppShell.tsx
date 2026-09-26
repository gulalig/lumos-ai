"use client";

import {
  Box,
  Divider,
  Drawer,
  Toolbar,
  Typography,
  drawerClasses,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import type { NavigationItem } from "@/config/navigation";

const DRAWER_WIDTH = 240;

const ShellRoot = styled(Box)({
  display: "flex",
  minHeight: "100vh",
});

const ShellDrawer = styled(Drawer)(({ theme }) => ({
  width: DRAWER_WIDTH,
  flexShrink: 0,

  [`& .${drawerClasses.paper}`]: {
    width: DRAWER_WIDTH,
    boxSizing: "border-box",
    borderRight: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
}));

const ShellToolbar = styled(Toolbar)(({ theme }) => ({
  minHeight: 64,
  paddingLeft: theme.spacing(3),
  paddingRight: theme.spacing(3),
}));

const ShellTitle = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
  letterSpacing: "-0.02em",
}));

const NavigationContainer = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(0.5),
  paddingTop: theme.spacing(2),
  paddingLeft: theme.spacing(1.5),
  paddingRight: theme.spacing(1.5),
}));

interface NavigationLinkProps {
  active: boolean;
}

const NavigationLink = styled(Link, {
  shouldForwardProp: (prop) => prop !== "active",
})<NavigationLinkProps>(({ theme, active }) => ({
  display: "grid",
  gridTemplateColumns: "40px minmax(0, 1fr)",
  alignItems: "center",
  minHeight: 44,
  paddingLeft: theme.spacing(1.5),
  paddingRight: theme.spacing(1.5),
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

const NavigationIcon = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
});

const NavigationLabel = styled(Typography)(({ theme }) => ({
  overflow: "hidden",
  fontWeight: theme.typography.fontWeightMedium,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
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

export function AppShell({ title, navigation, children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <ShellRoot>
      <ShellDrawer variant="permanent">
        <ShellToolbar>
          <ShellTitle variant="h6">{title}</ShellTitle>
        </ShellToolbar>

        <Divider />

        <NavigationContainer>
          {navigation.map((item) => {
            const Icon = item.icon;

            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <NavigationLink key={item.href} href={item.href} active={active}>
                <NavigationIcon>
                  <Icon fontSize="small" />
                </NavigationIcon>

                <NavigationLabel variant="body2">{item.label}</NavigationLabel>
              </NavigationLink>
            );
          })}
        </NavigationContainer>
      </ShellDrawer>

      <ShellContent>{children}</ShellContent>
    </ShellRoot>
  );
}
