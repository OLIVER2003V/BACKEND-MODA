import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateGarmentDto } from './dto/create-garment.dto';
import { UpdateGarmentDto } from './dto/update-garment.dto';
import { BulkCreateGarmentsDto } from './dto/bulk-create-garments.dto';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { StorageService } from 'src/common/storage/storage.service';
import { AiService } from '../ai/ai.service';
import { Category } from 'generated/prisma/enums';
// import { Category } from 'generated/prisma';

@Injectable()
export class GarmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly aiService: AiService,
  ) {}

  async bulkCreateWithCloset(
    userId: string,
    dto: BulkCreateGarmentsDto,
    files: Express.Multer.File[],
  ) {
    if (files.length !== dto.pathLocals.length) {
      throw new Error('Number of files must match number of pathLocals');
    }

    // Crear el closet
    const closet = await this.prisma.closet.create({
      data: {
        name: dto.closetName,
        description: dto.closetDescription,
        userId,
      },
    });

    // Subir imágenes, generar descripción y categoría con IA, y crear garments
    const garmentPromises = files.map(async (file, index) => {
      // Subir imagen al storage
      const uploaded = await this.storageService.uploadFile(file);

      // Generar descripción y categoría con IA
      let description: string | null = null;
      let category: Category | null = null;

      try {
        const aiResult = await this.aiService.describeGarment(
          file.buffer,
          file.mimetype,
        );
        description = aiResult.description;
        // Convertir string a enum Category
        if (aiResult.category in Category) {
          category = aiResult.category as Category;
        }
      } catch (error) {
        console.error(`Error al describir prenda ${index}:`, error.message);
        // Si falla la IA, continuamos sin descripción ni categoría
      }

      return this.prisma.garment.create({
        data: {
          path: uploaded.url,
          pathLocal: dto.pathLocals[index],
          description,
          category,
          closetId: closet.id,
        },
      });
    });

    const garments = await Promise.all(garmentPromises);

    return {
      closet,
      garments,
    };
  }

  async create(dto: CreateGarmentDto, file?: Express.Multer.File) {
    const closet = await this.prisma.closet.findUnique({
      where: { id: dto.closetId },
    });

    if (!closet) {
      throw new NotFoundException(`Closet with ID ${dto.closetId} not found`);
    }

    let path = '';
    if (file) {
      const uploaded = await this.storageService.uploadFile(file);
      path = uploaded.url;
    }

    return this.prisma.garment.create({
      data: {
        name: dto.name,
        path,
        pathLocal: dto.pathLocal,
        closetId: dto.closetId,
      },
    });
  }

  findAll() {
    return this.prisma.garment.findMany({
      include: {
        closet: true,
      },
    });
  }

  findByClosetId(closetId: string) {
    return this.prisma.garment.findMany({
      where: { closetId },
      include: {
        closet: true,
      },
    });
  }

  async findOne(id: string) {
    const garment = await this.prisma.garment.findUnique({
      where: { id },
      include: {
        closet: true,
      },
    });

    if (!garment) {
      throw new NotFoundException(`Garment with ID ${id} not found`);
    }

    return garment;
  }

  async update(id: string, dto: UpdateGarmentDto, file?: Express.Multer.File) {
    const garment = await this.prisma.garment.findUnique({
      where: { id },
    });

    if (!garment) {
      throw new NotFoundException(`Garment with ID ${id} not found`);
    }

    let path = garment.path;
    if (file) {
      // Eliminar imagen anterior si existe
      if (garment.path) {
        try {
          const oldFileName = garment.path.split('/').slice(-2).join('/');
          await this.storageService.deleteFile(oldFileName);
        } catch {
          // Ignorar error si no se puede eliminar
        }
      }

      const uploaded = await this.storageService.uploadFile(file);
      path = uploaded.url;
    }

    return this.prisma.garment.update({
      where: { id },
      data: {
        name: dto.name,
        pathLocal: dto.pathLocal,
        path,
      },
    });
  }

  async remove(id: string) {
    const garment = await this.prisma.garment.findUnique({
      where: { id },
    });

    if (!garment) {
      throw new NotFoundException(`Garment with ID ${id} not found`);
    }

    // Eliminar imagen de GCS si existe
    if (garment.path) {
      try {
        const fileName = garment.path.split('/').slice(-2).join('/');
        await this.storageService.deleteFile(fileName);
      } catch {
        // Ignorar error si no se puede eliminar
      }
    }

    return this.prisma.garment.delete({
      where: { id },
    });
  }

  async findByOutfitId(outfitId: string) {
  const outfit = await this.prisma.outfit.findUnique({
    where: { id: outfitId },
    include: {
      garmentOutfits: {
        include: {
          garment: true,
        },
        orderBy: {
          order: 'asc', // Opcional: ordena por posición en el outfit
        },
      },
    },
  });

  if (!outfit) {
    throw new HttpException('Outfit not found', 404);
  }

  // Retorna solo los garments
  return outfit.garmentOutfits.map((go) => go.garment);
}
}
