import { HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateUserAttributeDto } from './dto/create-user-attribute.dto';
import { UpdateUserAttributeDto } from './dto/update-user-attribute.dto';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { NotFoundError } from 'rxjs';

@Injectable()
export class UserAttributeService {
  private readonly logger = new Logger(UserAttributeService.name);
  constructor(private readonly prisma: PrismaService) {
    this.logger.log('UserAttributeService initialized');
  }

  create(createUserAttributeDto: CreateUserAttributeDto) {
    return this.prisma.userAttribute.create({ data: createUserAttributeDto });
  }

  async findByUserId(userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId } });
    if (!user) {
      return new HttpException('User not found', 404);
    }
    return this.prisma.userAttribute.findUnique({ where: { userId } });
  }

  findAll() {
    return this.prisma.userAttribute.findMany();
  }

  findOne(id: string) {
    return this.prisma.userAttribute.findUnique({ where: { id } });
  }

  update(id: string, updateUserAttributeDto: UpdateUserAttributeDto) {
    return this.prisma.userAttribute.update({
      where: { id },
      data: updateUserAttributeDto,
    });
  }

  remove(id: string) {
    return this.prisma.userAttribute.delete({ where: { id } });
  }
}
