import type { ReactNode } from "react";

import { Box, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

interface AppPageProps {
  children: ReactNode;
  className?: string;
}

interface AppPageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

const PageContainer = styled(Box)(({ theme }) => ({
  width: "100%",
  maxWidth: 1500,
  marginInline: "auto",
  padding: theme.spacing(4.5, 5),

  [theme.breakpoints.down("lg")]: {
    padding: theme.spacing(4),
  },

  [theme.breakpoints.down("md")]: {
    padding: theme.spacing(3),
  },

  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(2),
  },
}));

const HeaderRoot = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: theme.spacing(3),
  marginBottom: theme.spacing(3),

  [theme.breakpoints.down("md")]: {
    alignItems: "flex-start",
    flexDirection: "column",
  },
}));

const HeaderCopy = styled(Box)({
  minWidth: 0,
});

const HeaderTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 750,
  letterSpacing: "-0.04em",

  [theme.breakpoints.down("sm")]: {
    fontSize: "2rem",
  },
}));

const HeaderDescription = styled(Typography)(({ theme }) => ({
  maxWidth: 700,
  marginTop: theme.spacing(0.8),
  color: theme.palette.text.secondary,
  lineHeight: 1.65,
}));

const HeaderAction = styled(Box)({
  flexShrink: 0,
});

export function AppPage({ children, className }: AppPageProps) {
  return <PageContainer className={className}>{children}</PageContainer>;
}

export function AppPageHeader({
  title,
  description,
  action,
  className,
}: AppPageHeaderProps) {
  return (
    <HeaderRoot className={className}>
      <HeaderCopy>
        <HeaderTitle variant="h3">{title}</HeaderTitle>

        {description ? (
          <HeaderDescription variant="body1">{description}</HeaderDescription>
        ) : null}
      </HeaderCopy>

      {action ? <HeaderAction>{action}</HeaderAction> : null}
    </HeaderRoot>
  );
}
