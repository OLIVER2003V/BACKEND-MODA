import { Module } from '@nestjs/common';
import { UserAttributeService } from './user-attribute.service';
import { UserAttributeController } from './user-attribute.controller';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Module({
  controllers: [UserAttributeController],
  providers: [UserAttributeService, PrismaService],
})
export class UserAttributeModule {}
