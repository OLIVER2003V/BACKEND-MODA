import { IsArray, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BulkCreateGarmentsDto {
  @ApiProperty({ description: 'Nombre del closet a crear' })
  @IsString()
  closetName: string;

  @ApiPropertyOptional({ description: 'Descripción del closet' })
  @IsString()
  @IsOptional()
  closetDescription?: string;

  @ApiProperty({
    description: 'Lista de rutas locales de las imágenes (en el mismo orden que los archivos)',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  pathLocals: string[];
}
