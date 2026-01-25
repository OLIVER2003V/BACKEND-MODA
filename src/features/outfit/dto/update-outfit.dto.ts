import { PartialType } from '@nestjs/mapped-types';
import { CreateOutfitDto } from './create-outfit.dto';

export class UpdateOutfitDto extends PartialType(CreateOutfitDto) {}
