import { PartialType } from '@nestjs/swagger';
import { CreateGarmentDto } from './create-garment.dto';

export class UpdateGarmentDto extends PartialType(CreateGarmentDto) {}
