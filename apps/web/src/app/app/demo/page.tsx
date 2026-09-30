import { DemoMeetingView } from "@/features/demo/DemoMeetingView";
import { DemoPrerequisiteGate } from "@/features/demo/DemoPrerequisiteGate";

export default function DemoPage() {
  return (
    <DemoPrerequisiteGate>
      <DemoMeetingView />
    </DemoPrerequisiteGate>
  );
}
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Demo" };
