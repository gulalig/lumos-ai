"use client";

import { AdminPanelSettingsOutlined, LockOutlined } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  TextField,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { LumosLogo } from "@/components/brand/LumosLogo";
import { ROUTES } from "@/constants/routes";
import { useAdminLoginMutation } from "@/store/api/admin-auth.api";
import { useAppSelector } from "@/store/hooks";

const ACCENT_DARK = "#A9793C";
const ACCENT_SOFT = "#F7F0E6";

const Root = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
  padding: theme.spacing(3),
  backgroundColor: "#F8F8F9",
}));

const LoginCard = styled(Box)(({ theme }) => ({
  width: "100%",
  maxWidth: 430,
  padding: theme.spacing(4),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 22,
  backgroundColor: theme.palette.background.paper,
  boxShadow: "0 24px 70px rgba(24, 24, 27, 0.07)",

  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(3),
  },
}));

const BrandRow = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  marginBottom: theme.spacing(3),
}));

const AdminIcon = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 46,
  height: 46,
  marginInline: "auto",
  marginBottom: 18,
  borderRadius: 14,
  color: ACCENT_DARK,
  backgroundColor: ACCENT_SOFT,
});

const Title = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 750,
  textAlign: "center",
  letterSpacing: "-0.035em",
}));

const Description = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.75),
  color: theme.palette.text.secondary,
  lineHeight: 1.55,
  textAlign: "center",
}));

const Form = styled("form")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(2),
  marginTop: theme.spacing(3),
}));

const SignInButton = styled(Button)({
  minHeight: 46,
  marginTop: 4,
  backgroundColor: "#171717",
  color: "#FFFFFF",
  boxShadow: "none",

  "&:hover": {
    backgroundColor: ACCENT_DARK,
    boxShadow: "none",
  },
});

const SecurityNote = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: theme.spacing(0.65),
  marginTop: theme.spacing(2.5),
  color: theme.palette.text.secondary,
  fontSize: 11,
}));

export function AdminLoginView() {
  const router = useRouter();

  const admin = useAppSelector((state) => state.adminAuth.admin);

  const accessToken = useAppSelector((state) => state.adminAuth.accessToken);

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [login, { isLoading, error }] = useAdminLoginMutation();

  useEffect(() => {
    if (admin && accessToken) {
      router.replace(ROUTES.admin.dashboard);
    }
  }, [admin, accessToken, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password) {
      return;
    }

    try {
      await login({
        email: email.trim(),
        password,
      }).unwrap();

      router.replace(ROUTES.admin.dashboard);
    } catch {
      // Error is rendered below.
    }
  };

  return (
    <Root>
      <LoginCard>
        <BrandRow>
          <LumosLogo />
        </BrandRow>

        <AdminIcon>
          <AdminPanelSettingsOutlined />
        </AdminIcon>

        <Title variant="h4">Admin access</Title>

        <Description variant="body2">
          Sign in to the Lumos platform administration console.
        </Description>

        <Form onSubmit={handleSubmit}>
          {error ? (
            <Alert severity="error">Invalid admin email or password.</Alert>
          ) : null}

          <TextField
            label="Admin email"
            type="email"
            autoComplete="username"
            value={email}
            disabled={isLoading}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          />

          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            disabled={isLoading}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
          />

          <SignInButton
            type="submit"
            variant="contained"
            disabled={isLoading || !email.trim() || !password}
          >
            {isLoading ? (
              <>
                <CircularProgress size={18} color="inherit" />
                &nbsp; Signing in...
              </>
            ) : (
              "Sign in to Admin"
            )}
          </SignInButton>
        </Form>

        <SecurityNote>
          <LockOutlined fontSize="inherit" />
          Restricted platform access
        </SecurityNote>
      </LoginCard>
    </Root>
  );
}
