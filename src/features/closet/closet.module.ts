import { Module } from '@nestjs/common';
import { ClosetService } from './closet.service';
import { ClosetController } from './closet.controller';
import { PrismaModule } from 'src/common/prisma/prisma.module';

@Module({
  controllers: [ClosetController],
  providers: [ClosetService],
  imports: [PrismaModule],
})
export class ClosetModule {}
