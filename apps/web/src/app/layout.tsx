import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";

import "./globals.css";
import { Providers } from "@/app/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Lumos AI",
    template: "%s | Lumos AI",
  },

  description:
    "Lumos is a real-time meeting intelligence assistant that captures commitments and context and turns them into execution.",
  applicationName: "Lumos AI",
  openGraph: {
    type: "website",
    siteName: "Lumos AI",
    title: "Lumos AI",
    description:
      "Lumos is a real-time meeting intelligence assistant that captures commitments and context and turns them into execution.",
  },
  twitter: {
    card: "summary",
    title: "Lumos AI",
    description:
      "Lumos is a real-time meeting intelligence assistant that captures commitments and context and turns them into execution.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>
        <AppRouterCacheProvider>
          <Providers>{children}</Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
