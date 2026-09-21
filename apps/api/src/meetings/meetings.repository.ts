import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';

import type {
  CreateMeetingInput,
  Meeting,
} from './meeting.types.js';

@Injectable()
export class MeetingsRepository {
  constructor(
    private readonly database: DatabaseService,
  ) {}

  async create(
    input: CreateMeetingInput,
  ): Promise<Meeting> {
    const result =
      await this.database.query<Meeting>(
        `
          INSERT INTO meetings (
            id,
            room_name,
            status
          )
          VALUES (
                   $1,
                   $2,
                   'created'
                 )
            RETURNING
            id,
            room_name AS "roomName",
            status,
            created_at AS "createdAt",
            started_at AS "startedAt",
            ended_at AS "endedAt"
        `,
        [
          input.id,
          input.roomName,
        ],
      );

    const meeting = result.rows[0];

    if (!meeting) {
      throw new Error(
        'Meeting insert returned no row',
      );
    }

    return meeting;
  }

  async findById(
    id: string,
  ): Promise<Meeting | null> {
    const result =
      await this.database.query<Meeting>(
        `
          SELECT
            id,
            room_name AS "roomName",
            status,
            created_at AS "createdAt",
            started_at AS "startedAt",
            ended_at AS "endedAt"
          FROM meetings
          WHERE id = $1
            LIMIT 1
        `,
        [
          id,
        ],
      );

    return result.rows[0] ?? null;
  }

  async markActive(
    id: string,
  ): Promise<Meeting | null> {
    const result =
      await this.database.query<Meeting>(
        `
          UPDATE meetings
          SET
            status = 'active',
            started_at = COALESCE(
              started_at,
              NOW()
            )
          WHERE id = $1
            AND status IN (
              'created',
              'active'
            )
          RETURNING
            id,
            room_name AS "roomName",
            status,
            created_at AS "createdAt",
            started_at AS "startedAt",
            ended_at AS "endedAt"
        `,
        [
          id,
        ],
      );

    return result.rows[0] ?? null;
  }

  async markEnded(
    id: string,
  ): Promise<Meeting | null> {
    const result =
      await this.database.query<Meeting>(
        `
          UPDATE meetings
          SET
            status = 'ended',
            ended_at = COALESCE(
              ended_at,
              NOW()
            )
          WHERE id = $1
            AND status IN (
              'created',
              'active',
              'ended'
            )
          RETURNING
            id,
            room_name AS "roomName",
            status,
            created_at AS "createdAt",
            started_at AS "startedAt",
            ended_at AS "endedAt"
        `,
        [
          id,
        ],
      );

    return result.rows[0] ?? null;
  }
}
