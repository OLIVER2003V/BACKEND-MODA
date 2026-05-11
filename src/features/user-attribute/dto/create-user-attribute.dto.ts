import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateUserAttributeDto {
  // ── Datos físicos básicos ──────────────────────────────────────────────────

  @IsOptional() @IsString()
  @ApiProperty({ required: false, enum: ['MALE', 'FEMALE', 'NON_BINARY', 'OTHER'] })
  gender?: string;

  @IsOptional() @IsNumber() @Type(() => Number)
  @ApiProperty({ required: false, example: 25 })
  age?: number;

  @IsOptional() @IsNumber() @Type(() => Number)
  @ApiProperty({ required: false, example: 170, description: 'Estatura en cm' })
  stature?: number;

  @IsOptional() @IsNumber() @Type(() => Number)
  @ApiProperty({ required: false, example: 65, description: 'Peso en kg' })
  weight?: number;

  @IsOptional() @IsString()
  @ApiProperty({ required: false, enum: ['PEAR', 'RECTANGLE', 'HOURGLASS', 'APPLE', 'INVERTED_TRIANGLE'] })
  bodyType?: string;

  // ── Apariencia ────────────────────────────────────────────────────────────

  @IsOptional() @IsString()
  @ApiProperty({ required: false, enum: ['LIGHT', 'MEDIUM_LIGHT', 'MEDIUM', 'MEDIUM_DARK', 'DARK'] })
  skinTone?: string;

  @IsOptional() @IsString()
  @ApiProperty({ required: false, enum: ['WARM', 'COOL', 'NEUTRAL'], description: 'Subtono de piel (venas: verde=cálido, azul=frío, mezcla=neutro)' })
  skinSubtone?: string;

  @IsOptional() @IsString()
  @ApiProperty({ required: false, enum: ['OVAL', 'ROUND', 'SQUARE', 'HEART', 'OBLONG'] })
  faceType?: string;

  @IsOptional() @IsString()
  @ApiProperty({ required: false, description: 'Color de cabello — puede ser un valor predefinido o texto libre (ej: "rubio ceniza")' })
  hairColor?: string;

  @IsOptional() @IsString()
  @ApiProperty({ required: false, enum: ['STRAIGHT', 'WAVY', 'CURLY', 'COILY'] })
  hairType?: string;

  @IsOptional() @IsString()
  @ApiProperty({ required: false, description: 'Color de ojos — puede ser un valor predefinido o texto libre (ej: "verde esmeralda")' })
  eyeColor?: string;

  // ── Estilo y preferencias ─────────────────────────────────────────────────

  @IsOptional() @IsArray() @IsString({ each: true })
  @ApiProperty({ required: false, isArray: true, example: ['CASUAL', 'MINIMALIST'] })
  preferredStyles?: string[];

  @IsOptional() @IsArray() @IsString({ each: true })
  @ApiProperty({ required: false, isArray: true, example: ['blue', 'white'] })
  favoriteColors?: string[];

  @IsOptional() @IsArray() @IsString({ each: true })
  @ApiProperty({ required: false, isArray: true, example: ['yellow', 'orange'] })
  avoidColors?: string[];

  // ── Contexto de vida ──────────────────────────────────────────────────────

  @IsOptional() @IsString()
  @ApiProperty({ required: false, example: 'Diseñadora gráfica' })
  profession?: string;

  @IsOptional() @IsString()
  @ApiProperty({ required: false, enum: ['TROPICAL', 'DRY', 'TEMPERATE', 'CONTINENTAL', 'POLAR'] })
  climate?: string;

  @IsOptional() @IsString()
  @ApiProperty({ required: false, example: 'Buenos Aires', description: 'Ciudad o región para override manual de clima' })
  climateCity?: string;

  @IsOptional() @IsBoolean()
  @ApiProperty({ required: false, default: false, description: 'Activa recomendaciones de compra con talla y presupuesto' })
  shoppingEnabled?: boolean;

  @IsOptional() @IsString()
  @ApiProperty({ required: false, enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] })
  clothingSize?: string;

  @IsOptional() @IsNumber() @Type(() => Number)
  @ApiProperty({ required: false, example: 38, description: 'Talla de calzado' })
  shoeSize?: number;

  @IsOptional() @IsString()
  @ApiProperty({ required: false, enum: ['LOW', 'MEDIUM', 'HIGH', 'LUXURY'] })
  budget?: string;

  // ── Relación ──────────────────────────────────────────────────────────────

  @IsString()
  @ApiProperty({ description: 'ID del usuario' })
  userId: string;
}
