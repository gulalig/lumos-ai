"use client";

import { Box, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import Link from "next/link";

import { ROUTES } from "@/constants/routes";

const LogoLink = styled(Link)({
  display: "inline-flex",
  width: "fit-content",
  alignItems: "center",
  textDecoration: "none",
});

const LogoContent = styled(Box)({
  display: "flex",
  alignItems: "center",
});

const LogoText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: theme.typography.fontWeightBold,
  letterSpacing: "-0.04em",
}));

interface LumosLogoProps {
  href?: string;
}

export function LumosLogo({ href = ROUTES.home }: LumosLogoProps) {
  return (
    <LogoLink href={href}>
      <LogoContent>
        <LogoText variant="h5">Lumos</LogoText>
      </LogoContent>
    </LogoLink>
  );
}
