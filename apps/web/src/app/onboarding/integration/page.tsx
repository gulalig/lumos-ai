import { OnboardingShell } from "@/components/layout/OnboardingShell";
import { IntegrationOnboarding } from "@/features/onboarding/IntegrationOnboarding";

export default function IntegrationOnboardingPage() {
  return (
    <OnboardingShell currentStep={3}>
      <IntegrationOnboarding />
    </OnboardingShell>
  );
}
