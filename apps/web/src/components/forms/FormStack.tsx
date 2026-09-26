"use client";

import { styled } from "@mui/material/styles";

export const FormStack = styled("form")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(2.5),
}));
