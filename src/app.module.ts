import { Module } from '@nestjs/common';
import { UsersModule } from './features/users/users.module';
import { AuthModule } from './features/auth/auth.module';
import { UserAttributeModule } from './features/user-attribute/user-attribute.module';
import { ClosetModule } from './features/closet/closet.module';
import { GarmentModule } from './features/garment/garment.module';
import { OutfitModule } from './features/outfit/outfit.module';
import { StorageModule } from './common/storage/storage.module';
import { NotificationsModule } from './common/notifications/notifications.module';
import { AiModule } from './features/ai/ai.module';
import { PostModule } from './features/post/post.module';

@Module({
  imports: [
    StorageModule,
    NotificationsModule,
    UsersModule,
    AuthModule,
    UserAttributeModule,
    ClosetModule,
    GarmentModule,
    OutfitModule,
    AiModule,
    PostModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
