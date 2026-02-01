import {
  Controller,
  Post,
  Get,
  Body,
  UseInterceptors,
  UploadedFiles,
  ParseFilePipe,
  FileTypeValidator,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { HairstyleService } from './hairstyle.service';
import { UploadHairstylesDto } from './dto';

@Controller('hairstyle')
export class HairstyleController {
  constructor(private readonly hairstyleService: HairstyleService) {}

  @Post('upload')
  @UseInterceptors(FilesInterceptor('files', 20))
  async upload(
    @Body() dto: UploadHairstylesDto,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp|avif)$/i }),
        ],
      }),
    )
    files: Express.Multer.File[],
  ) {
    return this.hairstyleService.uploadHairstyles(files, dto.gender);
  }

  @Get()
  async findAll() {
    return this.hairstyleService.findAll();
  }
}
