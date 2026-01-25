import { IsOptional, IsString } from 'class-validator';

export class AnalyzeImageDto {
  @IsOptional()
  @IsString()
  additionalContext?: string; // Contexto adicional sobre qué buscar en la imagen
}