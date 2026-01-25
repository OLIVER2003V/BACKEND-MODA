import { IsNotEmpty, IsObject } from 'class-validator';

export class ValidateDiagramDto {
  @IsObject()
  @IsNotEmpty()
  gojsDiagram: any;
}