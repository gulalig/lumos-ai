"use client";

import { Box, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import type { ReactNode } from "react";

const CardRoot = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(4),
}));

const Header = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(1),
}));

const Title = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
  letterSpacing: "-0.03em",
}));

const Description = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
}));

interface AuthFormCardProps {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthFormCard({
  title,
  description,
  children,
  footer,
}: AuthFormCardProps) {
  return (
    <CardRoot>
      <Header>
        <Title variant="h4">{title}</Title>

        <Description variant="body1">{description}</Description>
      </Header>

      {children}

      {footer}
    </CardRoot>
  );
}
