import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { UpdateOutfitDto } from './dto/update-outfit.dto';

@Injectable()
export class OutfitService {
  constructor(private readonly prisma: PrismaService) {}

  findByUserId(userId: string) {
    return this.prisma.outfit.findMany({
      where: {
        garmentOutfits: {
          some: {
            garment: {
              closet: { userId },
            },
          },
        },
      },
      include: {
        garmentOutfits: {
          include: { garment: true },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const outfit = await this.prisma.outfit.findUnique({
      where: { id },
      include: {
        garmentOutfits: {
          include: { garment: true },
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!outfit) throw new NotFoundException(`Outfit with ID ${id} not found`);
    return outfit;
  }

  async update(id: string, dto: UpdateOutfitDto) {
    await this.findOne(id);
    return this.prisma.outfit.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.outfit.delete({ where: { id } });
  }

  async createManual(name: string, garmentIds: string[]) {
    return this.prisma.outfit.create({
      data: {
        name,
        score: 0,
        garmentOutfits: {
          create: garmentIds.map((garmentId, index) => ({ garmentId, order: index })),
        },
      },
      include: {
        garmentOutfits: {
          include: { garment: true },
          orderBy: { order: 'asc' },
        },
      },
    });
  }
}
