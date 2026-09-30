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
      main: "#C89B5B",
      dark: "#B88B4F",
      contrastText: "#FFFFFF",
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
          textTransform: "none",
          fontWeight: 600,
        },

        contained: {
          backgroundColor: "#C89B5B",
          color: "#FFFFFF",

          "&:hover": {
            backgroundColor: "#B88B4F",
          },

          "&.Mui-disabled": {
            backgroundColor: "#E3D2B8",
            color: "#FFFFFF",
          },
        },

        text: {
          color: "#C89B5B",

          "&:hover": {
            backgroundColor: "rgba(200, 155, 91, 0.08)",
          },
        },
      },
    },

    MuiTextField: {
      defaultProps: {
        size: "small",
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: "#FFFFFF",

          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#D9D9DE",
          },

          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#B8B8C0",
          },

          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#C89B5B",
            borderWidth: 1.5,
          },

          "&.Mui-error .MuiOutlinedInput-notchedOutline": {
            borderColor: "#D14343",
          },
        },
      },
    },

    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: "#666A73",

          "&.Mui-focused": {
            color: "#C89B5B",
          },

          "&.Mui-error": {
            color: "#D14343",
          },
        },
      },
    },

    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: "#A8A8B0",

          "&:hover": {
            backgroundColor: "rgba(200, 155, 91, 0.08)",
          },

          "&.Mui-checked": {
            color: "#C89B5B",
          },
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          color: "#666A73",

          "&:hover": {
            color: "#C89B5B",
            backgroundColor: "rgba(200, 155, 91, 0.08)",
          },
        },
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
