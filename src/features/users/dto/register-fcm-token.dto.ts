import { IsString } from "class-validator";

export class RegisterFcmTokenDto {
  @IsString()
  fcmToken: string;
}