import dataSource from '../database/data-source.js';

import { UserEntity } from './entities/user.entity.js';
import { WorkspaceMemberEntity } from './entities/workspace-member.entity.js';
import { WorkspaceEntity } from './entities/workspace.entity.js';

const DEV_USER_ID = '11111111-1111-4111-8111-111111111111';

const DEV_WORKSPACE_ID = '22222222-2222-4222-8222-222222222222';

const DEV_WORKSPACE_MEMBER_ID = '33333333-3333-4333-8333-333333333333';

async function seed(): Promise<void> {
  await dataSource.initialize();

  try {
    await dataSource.transaction(async (manager) => {
      const users = manager.getRepository(UserEntity);

      const workspaces = manager.getRepository(WorkspaceEntity);

      const members = manager.getRepository(WorkspaceMemberEntity);

      let user = await users.findOne({
        where: {
          id: DEV_USER_ID,
        },
      });

      if (!user) {
        user = users.create({
          id: DEV_USER_ID,

          email: 'dev@lumos.local',

          displayName: 'Lumos Developer',
        });
      } else {
        user.email = 'dev@lumos.local';

        user.displayName = 'Lumos Developer';
      }

      await users.save(user);

      let workspace = await workspaces.findOne({
        where: {
          id: DEV_WORKSPACE_ID,
        },
      });

      if (!workspace) {
        workspace = workspaces.create({
          id: DEV_WORKSPACE_ID,

          name: 'Lumos Dev',

          slug: 'lumos-dev',
        });
      } else {
        workspace.name = 'Lumos Dev';

        workspace.slug = 'lumos-dev';
      }

      await workspaces.save(workspace);

      let member = await members.findOne({
        where: {
          id: DEV_WORKSPACE_MEMBER_ID,
        },
      });

      if (!member) {
        member = members.create({
          id: DEV_WORKSPACE_MEMBER_ID,

          workspaceId: DEV_WORKSPACE_ID,

          userId: DEV_USER_ID,

          role: 'owner',

          jobTitle: 'Developer',

          teamName: 'Engineering',
        });
      } else {
        member.workspaceId = DEV_WORKSPACE_ID;

        member.userId = DEV_USER_ID;

        member.role = 'owner';

        member.jobTitle = 'Developer';

        member.teamName = 'Engineering';
      }

      await members.save(member);
    });

    console.log(`DEV_WORKSPACE_MEMBER_ID=${DEV_WORKSPACE_MEMBER_ID}`);
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((error: unknown) => {
  console.error(error);

  process.exitCode = 1;
});
