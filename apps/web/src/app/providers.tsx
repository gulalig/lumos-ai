"use client";

import { CssBaseline, ThemeProvider } from "@mui/material";
import type { ReactNode } from "react";
import { useState } from "react";
import { Provider } from "react-redux";

import { makeStore, type AppStore } from "@/store";
import { theme } from "@/theme/theme";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [store] = useState<AppStore>(() => makeStore());

  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />

        {children}
      </ThemeProvider>
    </Provider>
  );
}
