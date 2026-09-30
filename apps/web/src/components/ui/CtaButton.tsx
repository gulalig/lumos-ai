"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { styled } from "@mui/material/styles";

export type CtaButtonVariant = "primary" | "secondary" | "login";

interface StyledCtaButtonProps {
  variantType: CtaButtonVariant;
}

const HOVER_ACCENT = "#C89B5B";

const StyledCtaButton = styled(Link, {
  shouldForwardProp: (prop) => prop !== "variantType",
})<StyledCtaButtonProps>(({ theme, variantType }) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",

  minHeight: 36,

  paddingInline:
    variantType === "login" ? theme.spacing(2.5) : theme.spacing(2),

  borderRadius: 999,

  fontSize: theme.typography.body2.fontSize,
  fontWeight: theme.typography.fontWeightMedium,

  textDecoration: "none",

  transition:
    "background-color 180ms ease, color 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",

  ...(variantType === "primary"
    ? {
        color: theme.palette.common.white,

        backgroundColor: theme.palette.text.primary,

        border: "1px solid transparent",

        "&:hover": {
          color: theme.palette.common.white,

          backgroundColor: HOVER_ACCENT,

          borderColor: HOVER_ACCENT,

          boxShadow: "0 5px 16px rgba(200, 155, 91, 0.22)",

          transform: "translateY(-1px)",
        },

        "&:active": {
          transform: "translateY(0)",
        },
      }
    : variantType === "secondary"
      ? {
          color: theme.palette.text.primary,

          backgroundColor: theme.palette.action.hover,

          border: `1px solid ${theme.palette.divider}`,

          "&:hover": {
            color: theme.palette.common.white,

            backgroundColor: HOVER_ACCENT,

            borderColor: HOVER_ACCENT,

            boxShadow: "0 5px 16px rgba(200, 155, 91, 0.18)",

            transform: "translateY(-1px)",
          },

          "&:active": {
            transform: "translateY(0)",
          },
        }
      : {
          color: theme.palette.text.primary,

          backgroundColor: "transparent",

          border: "1px solid transparent",

          "&:hover": {
            backgroundColor: theme.palette.action.hover,

            borderColor: "transparent",
          },
        }),
}));

interface CtaButtonProps {
  href: string;
  children: ReactNode;
  variant?: CtaButtonVariant;
}

export function CtaButton({
  href,
  children,
  variant = "primary",
}: CtaButtonProps) {
  return (
    <StyledCtaButton href={href} variantType={variant}>
      {children}
    </StyledCtaButton>
  );
}
