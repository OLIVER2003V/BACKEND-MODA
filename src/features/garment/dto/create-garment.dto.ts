import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGarmentDto {
  @ApiPropertyOptional({ description: 'Nombre de la prenda' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Ruta local de la imagen' })
  @IsString()
  pathLocal: string;

  @ApiProperty({ description: 'ID del closet al que pertenece' })
  @IsString()
  closetId: string;
}
