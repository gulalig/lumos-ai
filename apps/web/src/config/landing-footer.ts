import { ROUTES } from "@/constants/routes";

export interface LandingFooterLink {
  label: string;
  href: string;
}

export interface LandingFooterSection {
  title: string;
  links: LandingFooterLink[];
}

export const LANDING_FOOTER_SECTIONS: LandingFooterSection[] = [
  {
    title: "Product",
    links: [
      {
        label: "Product",
        href: "#product",
      },
      {
        label: "How it works",
        href: "#how-it-works",
      },
      {
        label: "Integrations",
        href: "#integrations",
      },
    ],
  },
  {
    title: "Account",
    links: [
      {
        label: "Sign in",
        href: ROUTES.auth.login,
      },
      {
        label: "Sign up",
        href: ROUTES.auth.signup,
      },
    ],
  },
];
