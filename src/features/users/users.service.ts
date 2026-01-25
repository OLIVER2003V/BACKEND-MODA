import { Injectable } from '@nestjs/common';
import { CreateUserData } from './dto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { User } from 'generated/prisma/client';
import { RegisterFcmTokenDto } from './dto/register-fcm-token.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

}
