import { Module } from '@nestjs/common';
import { OutfitService } from './outfit.service';
import { OutfitController } from './outfit.controller';
import { PrismaModule } from 'src/common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OutfitController],
  providers: [OutfitService],
})
export class OutfitModule {}
