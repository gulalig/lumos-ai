"use client";

import { Box, Grid, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

const PageRoot = styled(Box)(({ theme }) => ({
  width: "100%",
  padding: theme.spacing(4),
}));

const PageHeader = styled(Grid)(({ theme }) => ({
  marginBottom: theme.spacing(4),
}));

const PageTitle = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(1),
  fontWeight: theme.typography.fontWeightBold,
  letterSpacing: "-0.03em",
}));

const PageDescription = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
}));

interface PagePlaceholderProps {
  title: string;
  description: string;
}

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <PageRoot>
      <PageHeader container>
        <Grid size={12}>
          <PageTitle variant="h4">{title}</PageTitle>

          <PageDescription variant="body1">{description}</PageDescription>
        </Grid>
      </PageHeader>
    </PageRoot>
  );
}
