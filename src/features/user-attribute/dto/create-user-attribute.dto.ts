import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDecimal, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateUserAttributeDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'Gender of the user' })
  gender: string;

  @IsOptional()
  @IsNumber()
  @ApiProperty({ required: false, description: 'Age of the user' })
  @Type(() => Number)
  age: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @ApiProperty({ required: false, description: 'Stature of the user' })
  stature: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @ApiProperty({ required: false, description: 'Weight of the user' })
  weight: number;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'Profession of the user' })
  profession: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'Test type of the user' })
  testType: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'Surface type of the user' })
  faceType: string;

  @IsString()
  @ApiProperty({ description: 'ID of the user' })
  userId: string;
}
