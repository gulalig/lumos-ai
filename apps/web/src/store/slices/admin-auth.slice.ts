import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { PlatformAdmin } from "@/features/admin-auth/admin-auth.types";

export interface AdminAuthState {
  accessToken: string | null;
  admin: PlatformAdmin | null;
  hydrated: boolean;
}

const initialState: AdminAuthState = {
  accessToken: null,
  admin: null,
  hydrated: false,
};

const adminAuthSlice = createSlice({
  name: "adminAuth",

  initialState,

  reducers: {
    setAdminAuth(
      state,
      action: PayloadAction<{
        accessToken: string;
        admin: PlatformAdmin;
      }>,
    ) {
      state.accessToken = action.payload.accessToken;

      state.admin = action.payload.admin;

      state.hydrated = true;
    },

    setAdminAccessToken(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;

      state.hydrated = true;
    },

    setAdminIdentity(state, action: PayloadAction<PlatformAdmin>) {
      state.admin = action.payload;

      state.hydrated = true;
    },

    markAdminAuthHydrated(state) {
      state.hydrated = true;
    },

    clearAdminAuth(state) {
      state.accessToken = null;
      state.admin = null;
      state.hydrated = true;
    },
  },
});

export const {
  setAdminAuth,
  setAdminAccessToken,
  setAdminIdentity,
  markAdminAuthHydrated,
  clearAdminAuth,
} = adminAuthSlice.actions;

export const adminAuthReducer = adminAuthSlice.reducer;
