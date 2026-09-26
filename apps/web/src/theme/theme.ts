"use client";

import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  cssVariables: true,

  palette: {
    mode: "light",

    background: {
      default: "#F7F7F8",
      paper: "#FFFFFF",
    },

    text: {
      primary: "#171717",
      secondary: "#666A73",
    },

    primary: {
      main: "#5B5BD6",
    },

    divider: "#E7E7EA",
  },

  typography: {
    fontFamily: "var(--font-geist-sans)",

    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },

  shape: {
    borderRadius: 12,
  },

  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },

      styleOverrides: {
        root: {
          minHeight: 40,
          borderRadius: 10,
          paddingInline: 16,
        },
      },
    },

    MuiTextField: {
      defaultProps: {
        size: "small",
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
  },
});
