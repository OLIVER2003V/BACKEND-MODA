import { PartialType } from '@nestjs/mapped-types';
import { CreateClosetDto } from './create-closet.dto';

export class UpdateClosetDto extends PartialType(CreateClosetDto) {}
