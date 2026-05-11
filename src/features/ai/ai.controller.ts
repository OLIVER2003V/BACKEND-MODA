import { Controller, Post, Body, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiService } from './ai.service';
import { AskQuestionDto, AnalyzeImageDto, FixMultiplicityDto, ValidateDiagramDto, GenerateOutfitDto } from './dto';
import { Express } from 'express';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('ask')
  async askQuestion(@Body() askQuestionDto: AskQuestionDto) {
    return this.aiService.askQuestion(askQuestionDto);
  }

  @Post('fix-multiplicity')
  async fixMultiplicity(@Body() fixMultiplicityDto: FixMultiplicityDto) {
    return this.aiService.fixMultiplicity(fixMultiplicityDto.gojsDiagram);
  }

  @Post('analyze-image')
  @UseInterceptors(FileInterceptor('image', {
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB máximo
    },
    fileFilter: (req, file, callback) => {
      // Verificar que sea una imagen
      if (!file.mimetype.startsWith('image/')) {
        return callback(new BadRequestException('Solo se permiten archivos de imagen'), false);
      }
      
      // Tipos de imagen soportados por OpenAI Vision
      const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/gif',
        'image/webp'
      ];
      
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return callback(new BadRequestException('Formato de imagen no soportado. Use: JPEG, PNG, GIF o WebP'), false);
      }
      
      callback(null, true);
    }
  }))
  async analyzeImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() analyzeImageDto: AnalyzeImageDto
  ) {
    if (!file) {
      throw new BadRequestException('No se ha proporcionado ninguna imagen');
    }

    return this.aiService.analyzeImage(
      file.buffer, 
      file.mimetype, 
      analyzeImageDto.additionalContext
    );
  }

  @Post('validate-diagram')
  async validateDiagram(@Body() validateDiagramDto: ValidateDiagramDto) {
    return this.aiService.validateAndCorrectDiagram(validateDiagramDto.gojsDiagram);
  }

  @Post('generate-outfit')
  async generateOutfit(@Body() generateOutfitDto: GenerateOutfitDto) {
    return this.aiService.generateOutfit(generateOutfitDto);
  }

  @Post('translate')
  async translate(@Body('text') text: string) {
    if (!text) throw new BadRequestException('Se requiere texto');
    return this.aiService.translateToSpanish(text);
  }

  @Post('generate-outfit-preview')
  async generateOutfitPreview(
    @Body('prompt') prompt: string,
    @Body('userId') userId?: string,
    @Body('outfitName') outfitName?: string,
  ) {
    if (!prompt) throw new BadRequestException('Se requiere un prompt');
    return this.aiService.generateOutfitPreview(prompt, userId, outfitName);
  }

  @Post('analyze-selfie')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_, file, cb) => {
      if (!['image/jpeg','image/jpg','image/png','image/webp'].includes(file.mimetype))
        return cb(new BadRequestException('Solo se permiten imágenes JPG, PNG o WebP'), false);
      cb(null, true);
    },
  }))
  async analyzeSelfie(
    @UploadedFile() file: Express.Multer.File,
    @Body('isFullBody') isFullBody?: string,
  ) {
    if (!file) throw new BadRequestException('No se proporcionó ninguna imagen');
    return this.aiService.analyzeSelfie(file.buffer, file.mimetype, isFullBody === 'true');
  }
}
