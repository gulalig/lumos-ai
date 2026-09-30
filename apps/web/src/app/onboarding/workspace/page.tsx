import { OnboardingShell } from "@/components/layout/OnboardingShell";
import { WorkspaceOnboardingForm } from "@/features/onboarding/WorkspaceOnboardingForm";

export default function WorkspaceOnboardingPage() {
  return (
    <OnboardingShell currentStep={1}>
      <WorkspaceOnboardingForm />
    </OnboardingShell>
  );
}
