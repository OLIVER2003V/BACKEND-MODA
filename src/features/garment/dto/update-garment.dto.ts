import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Category } from 'generated/prisma/enums';

export class UpdateGarmentDto {
  @ApiPropertyOptional() @IsString() @IsOptional() name?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() pathLocal?: string;
  @ApiPropertyOptional({ enum: Category }) @IsEnum(Category) @IsOptional() category?: Category;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
}
