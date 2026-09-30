"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, MenuItem, TextField, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { FormStack } from "@/components/forms/FormStack";
import { ROUTES } from "@/constants/routes";
import {
  workspaceOnboardingSchema,
  type WorkspaceOnboardingFormValues,
} from "@/features/onboarding/onboarding.schemas";
import { useCreateWorkspaceMutation } from "@/store/api/onboarding.api";

const Header = styled("div")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(1),
  marginBottom: theme.spacing(4),
}));

const Title = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
  letterSpacing: "-0.04em",
}));

const Description = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
}));

export function WorkspaceOnboardingForm() {
  const router = useRouter();

  const [createWorkspace, { isLoading, error }] = useCreateWorkspaceMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WorkspaceOnboardingFormValues>({
    resolver: zodResolver(workspaceOnboardingSchema),

    defaultValues: {
      companyName: "",
      industry: "",
      companySize: "",
      website: "",
    },
  });

  const onSubmit = async (values: WorkspaceOnboardingFormValues) => {
    try {
      await createWorkspace({
        name: values.companyName,
        industry: values.industry,
        companySize: values.companySize,
        website: values.website || undefined,
      }).unwrap();

      router.replace(ROUTES.onboarding.workflow);
    } catch {
      // Mutation error is rendered below.
    }
  };

  return (
    <>
      <Header>
        <Title variant="h3">Tell us about your company</Title>

        <Description variant="body1">
          We&apos;ll use this to create your Lumos workspace.
        </Description>
      </Header>

      <FormStack onSubmit={handleSubmit(onSubmit)}>
        {error ? (
          <Alert severity="error">
            We couldn&apos;t create your workspace. Please try again.
          </Alert>
        ) : null}

        <TextField
          label="Company name"
          autoComplete="organization"
          error={Boolean(errors.companyName)}
          helperText={errors.companyName?.message}
          {...register("companyName")}
        />
        <TextField
          label="Industry"
          error={Boolean(errors.industry)}
          helperText={errors.industry?.message}
          {...register("industry")}
        />

        <TextField
          select
          label="Company size"
          defaultValue=""
          error={Boolean(errors.companySize)}
          helperText={errors.companySize?.message}
          {...register("companySize")}
        >
          <MenuItem value="1-10">1–10</MenuItem>
          <MenuItem value="11-50">11–50</MenuItem>
          <MenuItem value="51-200">51–200</MenuItem>
          <MenuItem value="201-500">201–500</MenuItem>
          <MenuItem value="501+">501+</MenuItem>
        </TextField>

        <TextField
          label="Website"
          placeholder="https://example.com"
          error={Boolean(errors.website)}
          helperText={errors.website?.message ?? "Optional"}
          {...register("website")}
        />

        <Button type="submit" variant="contained" disabled={isLoading}>
          {isLoading ? "Creating workspace..." : "Continue"}
        </Button>
      </FormStack>
    </>
  );
}
