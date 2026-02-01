import { IsString, IsNotEmpty } from 'class-validator';

export class StartConversationDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}
