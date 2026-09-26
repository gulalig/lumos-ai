import { SetMetadata } from '@nestjs/common';

import type { WorkspaceMemberRole } from '../identity/entities/workspace-member.entity.js';

export const AUTH_ROLES_KEY = 'auth_roles';

export const Roles = (...roles: WorkspaceMemberRole[]) =>
  SetMetadata(AUTH_ROLES_KEY, roles);
