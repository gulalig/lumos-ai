"use client";

import { Box, Pagination, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

interface AppPaginationProps {
  page: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  hideWhenSinglePage?: boolean;
}

const PaginationRoot = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(2),
  padding: theme.spacing(1.5, 2.5),
  borderTop: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,

  [theme.breakpoints.down("sm")]: {
    alignItems: "flex-start",
    flexDirection: "column",
  },
}));

const PaginationInfo = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: 12,
}));

const StyledPagination = styled(Pagination)(({ theme }) => ({
  "& .MuiPaginationItem-root": {
    minWidth: 32,
    height: 32,
    borderRadius: 9,
    color: theme.palette.text.secondary,
    fontSize: 13,
    fontWeight: 600,
  },

  "& .MuiPaginationItem-root:hover": {
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.primary,
  },

  "& .MuiPaginationItem-root.Mui-selected": {
    backgroundColor: "rgba(200, 155, 91, 0.14)",
    color: "#8D652D",
  },

  "& .MuiPaginationItem-root.Mui-selected:hover": {
    backgroundColor: "rgba(200, 155, 91, 0.2)",
  },
}));

export function AppPagination({
  page,
  totalItems,
  itemsPerPage,
  onPageChange,
  itemLabel = "items",
  hideWhenSinglePage = true,
}: AppPaginationProps) {
  const pageCount = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  if (totalItems === 0 || (hideWhenSinglePage && pageCount <= 1)) {
    return null;
  }

  const start = (page - 1) * itemsPerPage + 1;

  const end = Math.min(page * itemsPerPage, totalItems);

  return (
    <PaginationRoot>
      <PaginationInfo>
        Showing {start}–{end} of {totalItems} {itemLabel}
      </PaginationInfo>

      <StyledPagination
        page={page}
        count={pageCount}
        shape="rounded"
        size="small"
        onChange={(_event, value) => {
          onPageChange(value);
        }}
      />
    </PaginationRoot>
  );
}
