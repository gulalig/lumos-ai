import { z } from "zod";

export const workspaceOnboardingSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, "Company name is required")
    .max(120, "Company name is too long"),

  industry: z
    .string()
    .trim()
    .min(2, "Industry is required")
    .max(120, "Industry is too long"),

  companySize: z.string().trim().min(1, "Company size is required"),

  website: z
    .string()
    .trim()
    .url("Enter a valid website")
    .optional()
    .or(z.literal("")),
});

export const workflowOnboardingSchema = z.object({
  jobTitle: z
    .string()
    .trim()
    .min(2, "Job title is required")
    .max(120, "Job title is too long"),

  teamName: z
    .string()
    .trim()
    .min(2, "Team is required")
    .max(120, "Team name is too long"),

  primaryUseCase: z
    .string()
    .trim()
    .min(2, "Primary use case is required")
    .max(200, "Primary use case is too long"),
});

export type WorkspaceOnboardingFormValues = z.infer<
  typeof workspaceOnboardingSchema
>;

export type WorkflowOnboardingFormValues = z.infer<
  typeof workflowOnboardingSchema
>;
