import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import type { AuthPrincipal } from './auth-principal.js';
import { RolesGuard } from './roles.guard.js';

function createContext(principal?: AuthPrincipal) {
  return {
    getHandler: vi.fn(() => function handler() {}),

    getClass: vi.fn(() => class Controller {}),

    switchToHttp: vi.fn(() => ({
      getRequest: vi.fn(() => ({
        user: principal,
      })),
    })),
  } as any;
}

describe('RolesGuard', () => {
  it('allows access when no roles are required', () => {
    const reflector = {
      getAllAndOverride: vi.fn(() => undefined),
    } as unknown as Reflector;

    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows an authenticated principal with a required role', () => {
    const reflector = {
      getAllAndOverride: vi.fn(() => ['owner', 'admin']),
    } as unknown as Reflector;

    const guard = new RolesGuard(reflector);

    const principal: AuthPrincipal = {
      userId: 'user-1',

      email: 'test@example.com',

      displayName: 'Test User',

      workspaceMemberId: 'member-1',

      workspaceId: 'workspace-1',

      role: 'admin',
    };

    expect(guard.canActivate(createContext(principal))).toBe(true);
  });

  it('rejects a principal without workspace membership when a role is required', () => {
    const reflector = {
      getAllAndOverride: vi.fn(() => ['owner']),
    } as unknown as Reflector;

    const guard = new RolesGuard(reflector);

    const principal: AuthPrincipal = {
      userId: 'user-1',

      email: 'test@example.com',

      displayName: 'Test User',

      workspaceMemberId: null,

      workspaceId: null,

      role: null,
    };

    expect(() => guard.canActivate(createContext(principal))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects a principal with an insufficient role', () => {
    const reflector = {
      getAllAndOverride: vi.fn(() => ['owner']),
    } as unknown as Reflector;

    const guard = new RolesGuard(reflector);

    const principal: AuthPrincipal = {
      userId: 'user-1',

      email: 'test@example.com',

      displayName: 'Test User',

      workspaceMemberId: 'member-1',

      workspaceId: 'workspace-1',

      role: 'member',
    };

    expect(() => guard.canActivate(createContext(principal))).toThrow(
      ForbiddenException,
    );
  });
});
