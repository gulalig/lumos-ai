"use client";

import { Box, CircularProgress } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { ROUTES } from "@/constants/routes";
import {
  ADMIN_ACCESS_TOKEN_KEY,
  useGetAdminMeQuery,
} from "@/store/api/admin-auth.api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  markAdminAuthHydrated,
  setAdminAccessToken,
} from "@/store/slices/admin-auth.slice";

interface AdminAuthGateProps {
  children: ReactNode;
}

const LoadingRoot = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
});

export function AdminAuthGate({ children }: AdminAuthGateProps) {
  const router = useRouter();

  const dispatch = useAppDispatch();

  const accessToken = useAppSelector((state) => state.adminAuth.accessToken);

  const admin = useAppSelector((state) => state.adminAuth.admin);

  const hydrated = useAppSelector((state) => state.adminAuth.hydrated);

  useEffect(() => {
    if (hydrated) {
      return;
    }

    const storedToken = window.localStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);

    if (storedToken) {
      dispatch(setAdminAccessToken(storedToken));

      return;
    }

    dispatch(markAdminAuthHydrated());
  }, [dispatch, hydrated]);

  const { isLoading, isFetching, isError } = useGetAdminMeQuery(undefined, {
    skip: !hydrated || !accessToken,
  });

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!accessToken) {
      router.replace(ROUTES.admin.login);

      return;
    }

    if (isError) {
      router.replace(ROUTES.admin.login);
    }
  }, [accessToken, hydrated, isError, router]);

  if (!hydrated || !accessToken || isLoading || isFetching || !admin) {
    return (
      <LoadingRoot>
        <CircularProgress size={30} />
      </LoadingRoot>
    );
  }

  return <>{children}</>;
}
