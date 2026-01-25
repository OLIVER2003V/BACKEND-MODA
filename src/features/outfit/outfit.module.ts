import { Module } from '@nestjs/common';
import { OutfitService } from './outfit.service';
import { OutfitController } from './outfit.controller';

@Module({
  controllers: [OutfitController],
  providers: [OutfitService],
})
export class OutfitModule {}
