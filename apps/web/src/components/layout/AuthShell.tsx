"use client";

import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";
import type { ReactNode } from "react";

import { LumosLogo } from "@/components/brand/LumosLogo";

interface AuthShellProps {
  children: ReactNode;
}

const ShellRoot = styled(Box)(({ theme }) => ({
  display: "grid",

  gridTemplateColumns: "minmax(0, 1fr) minmax(520px, 1fr)",

  minHeight: "100vh",

  backgroundColor: theme.palette.background.paper,

  [theme.breakpoints.down("lg")]: {
    gridTemplateColumns: "minmax(0, 1fr) 46%",
  },

  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "1fr",
  },
}));

const FormSide = styled(Box)(({ theme }) => ({
  position: "relative",

  display: "flex",

  minWidth: 0,

  minHeight: "100vh",

  alignItems: "center",

  justifyContent: "center",

  backgroundColor: "#F7F7F8",

  padding: theme.spacing(5),

  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(3),
  },
}));

const FormColumn = styled(Box)(({ theme }) => ({
  display: "grid",

  width: "100%",

  maxWidth: 440,

  gap: theme.spacing(5.5),

  [theme.breakpoints.down("sm")]: {
    gap: theme.spacing(4),
  },
}));

const BrandArea = styled(Box)({
  display: "flex",

  alignItems: "center",
});

const FormContent = styled(Box)({
  width: "100%",
});

const VisualSide = styled(Box)(({ theme }) => ({
  position: "relative",

  overflow: "hidden",

  minWidth: 0,

  minHeight: "100vh",

  isolation: "isolate",

  backgroundColor: "#F7F4EE",

  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}));

const BackgroundImage = styled("img")(({ theme }) => ({
  position: "absolute",

  top: "50%",

  left: "30%",

  zIndex: 0,

  width: "112vh",

  height: "auto",

  maxWidth: "none",

  objectFit: "contain",

  transform: "translate(-50%, -50%) rotate(90deg)",

  transformOrigin: "center",

  pointerEvents: "none",

  userSelect: "none",

  [theme.breakpoints.down("lg")]: {
    left: "40%",

    width: "118vh",
  },
}));

const PrepArtwork = styled("img")(({ theme }) => ({
  position: "absolute",

  top: "50%",

  left: "50%",

  zIndex: 2,

  width: "76%",

  maxWidth: 760,

  height: "auto",

  objectFit: "contain",

  transform: "translate(-48%, -50%)",

  filter: "drop-shadow(0 24px 44px rgba(70, 50, 20, 0.16))",

  pointerEvents: "none",

  userSelect: "none",

  [theme.breakpoints.down("lg")]: {
    width: "86%",
  },
}));

export function AuthShell({ children }: AuthShellProps) {
  return (
    <ShellRoot>
      <FormSide>
        <FormColumn>
          <BrandArea>
            <LumosLogo />
          </BrandArea>

          <FormContent>{children}</FormContent>
        </FormColumn>
      </FormSide>

      <VisualSide aria-hidden="true">
        <BackgroundImage src="/bg_img.webp" alt="" />

        <PrepArtwork src="/prep_img.webp" alt="" />
      </VisualSide>
    </ShellRoot>
  );
}
