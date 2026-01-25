import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  ParseFilePipe,
  FileTypeValidator,
} from '@nestjs/common';
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { GarmentService } from './garment.service';
import {
  CreateGarmentDto,
  UpdateGarmentDto,
  BulkCreateGarmentsDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from 'generated/prisma/client';
import { Express } from 'express'
@ApiTags('Garment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('garment')
export class GarmentController {
  constructor(private readonly garmentService: GarmentService) {}

  @Post('bulk')
  @ApiOperation({ summary: 'Crear closet con múltiples prendas' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['closetName', 'pathLocals', 'files'],
      properties: {
        closetName: { type: 'string', description: 'Nombre del closet' },
        closetDescription: {
          type: 'string',
          description: 'Descripción del closet',
        },
        pathLocals: {
          type: 'array',
          items: { type: 'string' },
          description: 'Lista de rutas locales',
        },
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Imágenes de las prendas',
        },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files', 50))
  bulkCreate(
    @GetUser() user: User,
    @Body() dto: BulkCreateGarmentsDto,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/i }),
        ],
      }),
    )
    files: Express.Multer.File[],
  ) {
    return this.garmentService.bulkCreateWithCloset(user.id, dto, files);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una prenda individual' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['pathLocal', 'closetId', 'file'],
      properties: {
        name: { type: 'string', description: 'Nombre de la prenda' },
        pathLocal: { type: 'string', description: 'Ruta local de la imagen' },
        closetId: { type: 'string', description: 'ID del closet' },
        file: {
          type: 'string',
          format: 'binary',
          description: 'Imagen de la prenda',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  create(
    @Body() dto: CreateGarmentDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/i }),
        ],
        fileIsRequired: false,
      }),
    )
    file?: Express.Multer.File,
  ) {
    return this.garmentService.create(dto, file);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las prendas' })
  findAll() {
    return this.garmentService.findAll();
  }

  @Get('closet/:closetId')
  @ApiOperation({ summary: 'Obtener prendas por closet' })
  findByCloset(@Param('closetId') closetId: string) {
    return this.garmentService.findByClosetId(closetId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una prenda por ID' })
  findOne(@Param('id') id: string) {
    return this.garmentService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una prenda' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre de la prenda' },
        pathLocal: { type: 'string', description: 'Ruta local de la imagen' },
        file: {
          type: 'string',
          format: 'binary',
          description: 'Nueva imagen de la prenda',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGarmentDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/i }),
        ],
        fileIsRequired: false,
      }),
    )
    file?: Express.Multer.File,
  ) {
    return this.garmentService.update(id, dto, file);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una prenda' })
  remove(@Param('id') id: string) {
    return this.garmentService.remove(id);
  }

  @Get(':outfitId/outfit')
  @ApiOperation({ summary: 'Obtener prendas por outfit' })
  findByOutfit(@Param('outfitId') outfitId: string) {
    return this.garmentService.findByOutfitId(outfitId);
  }

}
