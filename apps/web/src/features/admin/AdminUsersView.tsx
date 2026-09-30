"use client";

import {
  CheckCircleOutlineRounded,
  SearchRounded,
  UnpublishedOutlined,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { useMemo, useState } from "react";

import { AppPage } from "@/components/layout/AppPage";
import { AppPagination } from "@/components/navigation/AppPagination";
import { useGetAdminUsersQuery } from "@/store/api/admin-users.api";

const ITEMS_PER_PAGE = 10;

const Root = styled(AppPage)({});

const Header = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: theme.spacing(3),
  marginBottom: theme.spacing(3),

  [theme.breakpoints.down("md")]: {
    alignItems: "stretch",
    flexDirection: "column",
  },
}));

const HeaderCopy = styled(Box)({
  minWidth: 0,
});

const Title = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 750,
  letterSpacing: "-0.04em",
}));

const Description = styled(Typography)(({ theme }) => ({
  maxWidth: 700,
  marginTop: theme.spacing(0.75),
  color: theme.palette.text.secondary,
  lineHeight: 1.6,
}));

const SearchField = styled(TextField)({
  width: 320,
  maxWidth: "100%",
});

const TableCard = styled(Box)(({ theme }) => ({
  overflow: "hidden",
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 18,
  backgroundColor: theme.palette.background.paper,
}));

const TableHeader = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1.4fr 1.6fr 0.8fr 1.6fr 0.8fr",
  gap: theme.spacing(2),
  padding: theme.spacing(1.5, 2.5),
  color: theme.palette.text.secondary,
  backgroundColor: "#FAFAFB",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",

  [theme.breakpoints.down("lg")]: {
    gridTemplateColumns: "1.4fr 1.6fr 0.8fr 1.4fr",
  },

  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}));

const UserRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1.4fr 1.6fr 0.8fr 1.6fr 0.8fr",
  gap: theme.spacing(2),
  alignItems: "center",
  minHeight: 78,
  padding: theme.spacing(1.6, 2.5),
  borderTop: `1px solid ${theme.palette.divider}`,

  [theme.breakpoints.down("lg")]: {
    gridTemplateColumns: "1.4fr 1.6fr 0.8fr 1.4fr",
  },

  [theme.breakpoints.down("md")]: {
    display: "flex",
    alignItems: "flex-start",
    flexDirection: "column",
  },
}));

const PrimaryText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 650,
}));

const SecondaryText = styled(Typography)(({ theme }) => ({
  marginTop: 2,
  color: theme.palette.text.secondary,
}));

const Memberships = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(0.7),
}));

const EmptyState = styled(Box)(({ theme }) => ({
  padding: theme.spacing(7, 3),
  color: theme.palette.text.secondary,
  textAlign: "center",
}));

const Loading = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 500,
});

const ErrorAlert = styled(Alert)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function roleLabel(role: "owner" | "admin" | "member"): string {
  if (role === "owner") {
    return "Owner";
  }

  if (role === "admin") {
    return "Admin";
  }

  return "Member";
}

export function AdminUsersView() {
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);

  const { data = [], isLoading, error } = useGetAdminUsersQuery();

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return data;
    }

    return data.filter((user) => {
      const workspaceText = user.memberships
        .map((membership) => `${membership.workspaceName} ${membership.role}`)
        .join(" ");

      return [user.displayName, user.email, workspaceText]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));

  const safePage = Math.min(page, totalPages);

  const visibleUsers = filtered.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  if (isLoading) {
    return (
      <Loading>
        <CircularProgress size={30} />
      </Loading>
    );
  }

  return (
    <Root>
      <Header>
        <HeaderCopy>
          <Title variant="h3">Users</Title>

          <Description variant="body1">
            Review registered Lumos users, verification status and workspace
            memberships.
          </Description>
        </HeaderCopy>

        <SearchField
          size="small"
          placeholder="Search users..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);

            setPage(1);
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
      </Header>

      {error ? (
        <ErrorAlert severity="error">Unable to load users.</ErrorAlert>
      ) : null}

      <TableCard>
        <TableHeader>
          <span>User</span>
          <span>Email</span>
          <span>Status</span>
          <span>Workspace</span>
          <span>Joined</span>
        </TableHeader>

        {visibleUsers.length === 0 ? (
          <EmptyState>
            <Typography variant="body2">No users found.</Typography>
          </EmptyState>
        ) : (
          visibleUsers.map((user) => (
            <UserRow key={user.id}>
              <Box>
                <PrimaryText variant="body2">{user.displayName}</PrimaryText>

                <SecondaryText variant="caption">{user.id}</SecondaryText>
              </Box>

              <PrimaryText variant="body2">{user.email}</PrimaryText>

              <Box>
                {user.emailVerified ? (
                  <Chip
                    size="small"
                    icon={<CheckCircleOutlineRounded />}
                    label="Verified"
                    variant="outlined"
                  />
                ) : (
                  <Chip
                    size="small"
                    icon={<UnpublishedOutlined />}
                    label="Unverified"
                    variant="outlined"
                  />
                )}
              </Box>

              <Memberships>
                {user.memberships.length === 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    No workspace
                  </Typography>
                ) : (
                  user.memberships.map((membership) => (
                    <Chip
                      key={`${user.id}-${membership.workspaceId}`}
                      size="small"
                      label={`${membership.workspaceName} · ${roleLabel(
                        membership.role,
                      )}`}
                      variant="outlined"
                    />
                  ))
                )}
              </Memberships>

              <PrimaryText variant="body2">
                {formatDate(user.createdAt)}
              </PrimaryText>
            </UserRow>
          ))
        )}
      </TableCard>

      <AppPagination
        page={safePage}
        totalItems={filtered.length}
        itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={setPage}
        itemLabel="users"
        hideWhenSinglePage
      />
    </Root>
  );
}
