import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import type { HairstyleModel } from '../../../generated/prisma/models/Hairstyle';
import { AiService } from 'src/features/ai/ai.service';
import { StorageService } from 'src/common/storage/storage.service';

@Injectable()
export class HairstyleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly storageService: StorageService,
  ) {}

  async uploadHairstyles(files: Express.Multer.File[], gender?: string) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Debe enviar al menos una imagen');
    }

    const createdHairstyles: HairstyleModel[] = [];

    for (const file of files) {
      // 1. Upload to GCS
      const uploaded = await this.storageService.uploadFile(file, 'hairstyles');

      // 2. Analyze with AI
      const analysis = await this.aiService.describeHairstyle(
        file.buffer,
        file.mimetype,
      );

      // 3. Save to DB
      const hairstyle = await this.prisma.hairstyle.create({
        data: {
          description: analysis.description,
          imageUrl: uploaded.url,
          imagePath: uploaded.fileName,
          gender: gender || analysis.gender,
        },
      });

      createdHairstyles.push(hairstyle);
    }

    return createdHairstyles;
  }

  async findAll() {
    const hairstyles = await this.prisma.hairstyle.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Refresh signed URLs
    const withUrls = await Promise.all(
      hairstyles.map(async (h) => ({
        ...h,
        imageUrl: await this.storageService.getSignedUrl(h.imagePath),
      })),
    );

    return withUrls;
  }
}
