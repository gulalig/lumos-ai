"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, MenuItem, TextField, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { FormStack } from "@/components/forms/FormStack";
import { ROUTES } from "@/constants/routes";
import {
  workflowOnboardingSchema,
  type WorkflowOnboardingFormValues,
} from "@/features/onboarding/onboarding.schemas";
import { useCompleteWorkflowMutation } from "@/store/api/onboarding.api";

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
  lineHeight: 1.7,
}));

export function WorkflowOnboardingForm() {
  const router = useRouter();

  const [completeWorkflow, { isLoading, error }] =
    useCompleteWorkflowMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WorkflowOnboardingFormValues>({
    resolver: zodResolver(workflowOnboardingSchema),

    defaultValues: {
      jobTitle: "",
      teamName: "",
      primaryUseCase: "",
    },
  });

  const onSubmit = async (values: WorkflowOnboardingFormValues) => {
    try {
      await completeWorkflow({
        jobTitle: values.jobTitle,
        teamName: values.teamName,
        primaryUseCase: values.primaryUseCase,
      }).unwrap();

      router.replace(ROUTES.onboarding.integration);
    } catch {
      // Mutation error is rendered below.
    }
  };

  return (
    <>
      <Header>
        <Title variant="h3">Set up your workflow</Title>

        <Description variant="body1">
          Tell us how you work so Lumos can fit naturally into your team&apos;s
          process.
        </Description>
      </Header>

      <FormStack onSubmit={handleSubmit(onSubmit)}>
        {error ? (
          <Alert severity="error">
            We couldn&apos;t save your workflow setup. Please try again.
          </Alert>
        ) : null}

        <TextField
          label="Your job title"
          placeholder="Founder, Product Manager, Engineer..."
          autoComplete="organization-title"
          error={Boolean(errors.jobTitle)}
          helperText={errors.jobTitle?.message}
          {...register("jobTitle")}
        />

        <TextField
          label="Team or department"
          placeholder="Engineering, Product, Sales..."
          error={Boolean(errors.teamName)}
          helperText={errors.teamName?.message}
          {...register("teamName")}
        />

        <TextField
          select
          label="Primary use case"
          defaultValue=""
          error={Boolean(errors.primaryUseCase)}
          helperText={errors.primaryUseCase?.message}
          {...register("primaryUseCase")}
        >
          <MenuItem value="meeting-notes">Meeting notes</MenuItem>

          <MenuItem value="action-items">Action items and ownership</MenuItem>

          <MenuItem value="jira-execution">
            Jira execution and follow-up
          </MenuItem>

          <MenuItem value="team-follow-up">Team follow-up</MenuItem>

          <MenuItem value="client-meetings">Client meetings</MenuItem>
        </TextField>

        <Button type="submit" variant="contained" disabled={isLoading}>
          {isLoading ? "Saving..." : "Continue"}
        </Button>
      </FormStack>
    </>
  );
}
