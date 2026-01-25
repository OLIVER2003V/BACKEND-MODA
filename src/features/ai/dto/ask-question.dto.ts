import { IsNotEmpty, IsString } from 'class-validator';

export class AskQuestionDto {
  @IsNotEmpty()
  @IsString()
  question: string;
}
