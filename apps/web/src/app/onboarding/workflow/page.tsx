import { OnboardingShell } from "@/components/layout/OnboardingShell";
import { WorkflowOnboardingForm } from "@/features/onboarding/WorkflowOnboardingForm";

export default function WorkflowOnboardingPage() {
  return (
    <OnboardingShell currentStep={2}>
      <WorkflowOnboardingForm />
    </OnboardingShell>
  );
}
