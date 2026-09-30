"use client";

import Image from "next/image";
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

const LogoContent = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
}));

const LogoText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: theme.typography.fontWeightBold,
  letterSpacing: "-0.04em",
}));

const LogoIcon = styled(Image)({
  display: "block",
  width: 36,
  height: 36,
  objectFit: "contain",
  transform: "translate(-6px, -4px)",
});

interface LumosLogoProps {
  href?: string;
}

export function LumosLogo({ href = ROUTES.home }: LumosLogoProps) {
  return (
    <LogoLink href={href}>
      <LogoContent>
        <LogoText variant="h5">Lumos</LogoText>

        <LogoIcon
          src="/lumos_logo.svg"
          alt="Lumos"
          width={36}
          height={36}
          priority
        />
      </LogoContent>
    </LogoLink>
  );
}
