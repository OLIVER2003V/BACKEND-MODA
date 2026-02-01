import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PrismaModule } from 'src/common/prisma/prisma.module';
import { AiModule } from 'src/features/ai/ai.module';

@Module({
  imports: [
    MulterModule.register({
      storage: multer.memoryStorage(),
    }),
    PrismaModule,
    AiModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
