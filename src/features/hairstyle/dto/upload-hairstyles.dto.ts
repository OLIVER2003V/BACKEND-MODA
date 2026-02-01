import { IsOptional, IsIn } from 'class-validator';

export class UploadHairstylesDto {
  @IsOptional()
  @IsIn(['MALE', 'FEMALE', 'UNISEX'])
  gender?: string;
}
