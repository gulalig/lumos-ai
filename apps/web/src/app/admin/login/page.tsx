import { AdminLoginView } from "@/features/admin-auth/AdminLoginView";

export default function AdminLoginPage() {
  return <AdminLoginView />;
}
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin login" };
