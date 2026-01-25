import { applyDecorators, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../guards";


export const Auth = () => {
  return applyDecorators(
    UseGuards(JwtAuthGuard),
  );
};