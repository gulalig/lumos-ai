import { configureStore } from "@reduxjs/toolkit";

import { adminBaseApi } from "@/store/api/admin-base-api";
import { adminAuthReducer } from "@/store/slices/admin-auth.slice";

import { baseApi } from "./api/base-api";
import { authReducer } from "./slices/auth.slice";

export const makeStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,

      adminAuth: adminAuthReducer,

      [baseApi.reducerPath]: baseApi.reducer,

      [adminBaseApi.reducerPath]: adminBaseApi.reducer,
    },

    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(
        baseApi.middleware,
        adminBaseApi.middleware,
      ),
  });

export type AppStore = ReturnType<typeof makeStore>;

export type RootState = ReturnType<AppStore["getState"]>;

export type AppDispatch = AppStore["dispatch"];
