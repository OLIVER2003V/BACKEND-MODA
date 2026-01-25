import { HttpException, Injectable } from '@nestjs/common';
import { CreateClosetDto } from './dto/create-closet.dto';
import { UpdateClosetDto } from './dto/update-closet.dto';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class ClosetService {

  constructor(
    private readonly prisma: PrismaService
  ) {}

  create(createClosetDto: CreateClosetDto) {
    return this.prisma.closet.create({ data: createClosetDto });
  }

  async findByUserId( userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId } });
    if (!user) {
      return new HttpException('User not found', 404);
    }

    const closet =  await this.prisma.closet.findFirst({ where: { userId } });
    if (!closet) {
      return new HttpException('No closets found for this user', 404);
    }

    const garments = await this.prisma.garment.findMany({ where: { closetId: closet.id } });

    return { closet, garments };
  }

  findAll() {
    return `This action returns all closet`;
  }

  findOne(id: number) {
    return `This action returns a #${id} closet`;
  }

  update(id: string, updateClosetDto: UpdateClosetDto) {
    return this.prisma.closet.update({
      where: { id: id },
      data: updateClosetDto,
    });
  }

  remove(id: string) {
    return this.prisma.closet.delete({ where: { id } });
  }
}
