import type { SvgIconComponent } from "@mui/icons-material";
import {
  DashboardOutlined,
  GroupsOutlined,
  IntegrationInstructionsOutlined,
  ListAltOutlined,
  MeetingRoomOutlined,
  PlayCircleOutlineRounded,
  SettingsOutlined,
  TimelineOutlined,
  WorkspacesOutlined,
} from "@mui/icons-material";

import { ROUTES } from "@/constants/routes";

export interface NavigationItem {
  label: string;
  href: string;
  icon: SvgIconComponent;
}

export const CLIENT_NAVIGATION: NavigationItem[] = [
  {
    label: "Overview",
    href: ROUTES.app.dashboard,
    icon: DashboardOutlined,
  },
  {
    label: "Demo",
    href: ROUTES.app.demo,
    icon: PlayCircleOutlineRounded,
  },
  {
    label: "Meetings",
    href: ROUTES.app.meetings,
    icon: MeetingRoomOutlined,
  },
  {
    label: "Sprint",
    href: ROUTES.app.sprint,
    icon: ListAltOutlined,
  },
  {
    label: "Activity",
    href: ROUTES.app.activity,
    icon: TimelineOutlined,
  },
];

export const ADMIN_NAVIGATION: NavigationItem[] = [
  {
    label: "Overview",
    href: ROUTES.admin.dashboard,
    icon: DashboardOutlined,
  },
  {
    label: "Users",
    href: ROUTES.admin.users,
    icon: GroupsOutlined,
  },
  {
    label: "Workspaces",
    href: ROUTES.admin.workspaces,
    icon: WorkspacesOutlined,
  },
  {
    label: "Integrations",
    href: ROUTES.admin.integrations,
    icon: IntegrationInstructionsOutlined,
  },
  {
    label: "System",
    href: ROUTES.admin.system,
    icon: SettingsOutlined,
  },
];
