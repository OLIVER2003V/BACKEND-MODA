import { Module } from '@nestjs/common';
import { GarmentService } from './garment.service';
import { GarmentController } from './garment.controller';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [GarmentController],
  providers: [GarmentService, PrismaService],
  exports: [GarmentService],
})
export class GarmentModule {}
