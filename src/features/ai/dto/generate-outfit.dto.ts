import { IsString, IsNotEmpty } from 'class-validator';

export class GenerateOutfitDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  event: string; // cena, reunion, fiesta, trabajo, casual, etc.

  @IsString()
  @IsNotEmpty()
  weather: string; // caluroso, frio, templado, lluvioso, etc.
}
