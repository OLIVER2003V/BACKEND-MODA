import { IsOptional, IsString } from 'class-validator';

export class CreateClosetDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  userId: string;
}
