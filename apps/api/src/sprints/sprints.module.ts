import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SprintItemEntity } from './entities/sprint-item.entity.js';
import { SprintEntity } from './entities/sprint.entity.js';
import { SprintsRepository } from './sprints.repository.js';
import { SprintsService } from './sprints.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SprintEntity,
      SprintItemEntity,
    ]),
  ],
  providers: [SprintsRepository, SprintsService],
  exports: [SprintsRepository, SprintsService],
})
export class SprintsModule {}
