import { IsObject, IsNotEmpty } from 'class-validator';

export class FixMultiplicityDto {
  @IsNotEmpty()
  @IsObject()
  gojsDiagram: any; // JSON object del diagrama GoJS
}