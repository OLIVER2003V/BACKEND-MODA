import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserData } from './dto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { User } from 'generated/prisma/client';
import { RegisterFcmTokenDto } from './dto/register-fcm-token.dto';
import { SetAvatarDto } from './dto/set-avatar.dto';
import { StorageService } from 'src/common/storage/storage.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async create(userData: CreateUserData): Promise<User> {
    const hashedPassword = await this.hashPassword(userData.password);

    return this.prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
      },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async hashPassword(password: string): Promise<string> {
    const salt = 10;
    return bcrypt.hash(password, salt);
  }

  async comparePasswords(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async registerFcmToken(userId: string, registerFcmTokenDto: RegisterFcmTokenDto): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken: registerFcmTokenDto.fcmToken },
    });
  }

  async uploadProfilePhoto(userId: string, file: Express.Multer.File): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`Usuario ${userId} no encontrado`);

    // Delete old photo from Cloudinary if exists
    if (user.profilePhoto) {
      const fileName = user.profilePhoto.split('/').pop()?.split('.')[0]
      if (fileName) await this.storage.deleteFile(`profile-photos/${fileName}`).catch(() => null)
    }

    const uploaded = await this.storage.uploadFile(file, 'profile-photos')

    return this.prisma.user.update({
      where: { id: userId },
      data: { profilePhoto: uploaded.url, avatarStyle: null },
    });
  }

  async removeProfilePhoto(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`Usuario ${userId} no encontrado`);

    if (user.profilePhoto) {
      const fileName = user.profilePhoto.split('/').pop()?.split('.')[0]
      if (fileName) await this.storage.deleteFile(`profile-photos/${fileName}`).catch(() => null)
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { profilePhoto: null },
    });
  }

  async setAvatar(userId: string, dto: SetAvatarDto): Promise<User & { avatarUrl: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`Usuario ${userId} no encontrado`);

    // Remove real photo if it exists (mutual exclusion)
    if (user.profilePhoto) {
      const fileName = user.profilePhoto.split('/').pop()?.split('.')[0]
      if (fileName) await this.storage.deleteFile(`profile-photos/${fileName}`).catch(() => null)
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarStyle: dto.style, profilePhoto: null },
    });

    return {
      ...updated,
      avatarUrl: `https://api.dicebear.com/9.x/${dto.style}/svg?seed=${userId}`,
    };
  }

}
