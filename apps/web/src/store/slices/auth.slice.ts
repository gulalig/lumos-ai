import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { AuthState, AuthUser, AuthWorkspace } from "@/types/auth";

interface SetAuthPayload {
  accessToken: string;
  user: AuthUser;
  workspace: AuthWorkspace | null;
}

interface SetIdentityPayload {
  user: AuthUser;
  workspace: AuthWorkspace | null;
}

const initialState: AuthState = {
  accessToken: null,
  user: null,
  workspace: null,
};

const authSlice = createSlice({
  name: "auth",

  initialState,

  reducers: {
    setAuth(state, action: PayloadAction<SetAuthPayload>) {
      state.accessToken = action.payload.accessToken;

      state.user = action.payload.user;

      state.workspace = action.payload.workspace;
    },

    setIdentity(state, action: PayloadAction<SetIdentityPayload>) {
      state.user = action.payload.user;

      state.workspace = action.payload.workspace;
    },

    setAccessToken(state, action: PayloadAction<string | null>) {
      state.accessToken = action.payload;
    },

    setWorkspace(state, action: PayloadAction<AuthWorkspace | null>) {
      state.workspace = action.payload;
    },

    clearAuth(state) {
      state.accessToken = null;
      state.user = null;
      state.workspace = null;
    },
  },
});

export const { setAuth, setIdentity, setAccessToken, setWorkspace, clearAuth } =
  authSlice.actions;

export const authReducer = authSlice.reducer;
