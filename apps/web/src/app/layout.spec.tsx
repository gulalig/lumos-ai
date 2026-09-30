import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import RootLayout, { metadata } from "./layout";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "sans" }),
  Geist_Mono: () => ({ variable: "mono" }),
}));
vi.mock("@mui/material-nextjs/v15-appRouter", () => ({
  AppRouterCacheProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));
vi.mock("@/app/providers", () => ({
  Providers: ({ children }: { children: React.ReactNode }) => children,
}));

describe("root smooth scrolling", () => {
  it("declares intentional smooth scrolling to Next route transitions without removing the CSS", () => {
    const html = renderToStaticMarkup(
      <RootLayout params={Promise.resolve({})}>
        <span>Page</span>
      </RootLayout>,
    );
    expect(html).toContain('data-scroll-behavior="smooth"');
    const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
    expect(css).toMatch(/html\s*\{[^}]*scroll-behavior:\s*smooth/);
  });
});

describe("production metadata", () => {
  it("uses the product name, template, description and text-only social metadata", () => {
    expect(metadata.title).toEqual({
      default: "Lumos AI",
      template: "%s | Lumos AI",
    });
    expect(metadata.applicationName).toBe("Lumos AI");
    expect(metadata.description).toContain("real-time meeting intelligence");
    expect(metadata.openGraph).toMatchObject({
      title: "Lumos AI",
      siteName: "Lumos AI",
      description: metadata.description,
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary",
      title: "Lumos AI",
      description: metadata.description,
    });
    expect(metadata.openGraph).not.toHaveProperty("images");
    expect(metadata.twitter).not.toHaveProperty("images");
  });

  it("uses the actual Lumos SVG unchanged through the app-router icon convention", () => {
    const icon = readFileSync(new URL("./icon.svg", import.meta.url), "utf8");
    const logo = readFileSync(
      new URL("../../public/lumos_logo.svg", import.meta.url),
      "utf8",
    );
    expect(icon.trim()).toBe(logo.trim());
    expect(icon).toContain("Lumos logo icon");
  });

  it.each([
    ["(auth)/login/page.tsx", "Login"],
    ["(auth)/signup/page.tsx", "Signup"],
    ["(auth)/forgot-password/page.tsx", "Forgot password"],
    ["(auth)/reset-password/page.tsx", "Reset password"],
    ["(auth)/verify-email/page.tsx", "Verify email"],
    ["app/dashboard/page.tsx", "Overview"],
    ["app/demo/page.tsx", "Demo"],
    ["app/meetings/page.tsx", "Meetings"],
    ["app/meetings/[meetingId]/page.tsx", "Meeting"],
    ["app/sprint/page.tsx", "Sprint"],
    ["app/activity/page.tsx", "Activity"],
    ["app/settings/page.tsx", "Settings"],
    ["app/integrations/page.tsx", "Integrations"],
    ["onboarding/layout.tsx", "Onboarding"],
    ["admin/dashboard/page.tsx", "Admin"],
    ["admin/login/page.tsx", "Admin login"],
    ["admin/integrations/page.tsx", "Admin integrations"],
    ["admin/system/page.tsx", "Admin system"],
    ["admin/users/page.tsx", "Admin users"],
    ["admin/workspaces/page.tsx", "Admin workspaces"],
  ])("%s declares its real page title (%s) on the server", (path, title) => {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    expect(source).toContain('export const metadata: Metadata = { title: "' + title + '" }');
    expect(source).not.toContain('"use client"');
    expect(source).not.toContain("document.title");
  });
});
