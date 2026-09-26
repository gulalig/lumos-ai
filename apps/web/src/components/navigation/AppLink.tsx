"use client";

import { styled } from "@mui/material/styles";
import Link from "next/link";

export const AppLink = styled(Link)(({ theme }) => ({
  color: theme.palette.primary.main,
  fontSize: theme.typography.body2.fontSize,
  fontWeight: theme.typography.fontWeightMedium,
  textDecoration: "none",

  "&:hover": {
    textDecoration: "underline",
  },
}));
