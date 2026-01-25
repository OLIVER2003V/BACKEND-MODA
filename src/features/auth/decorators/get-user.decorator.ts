import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { User } from "generated/prisma/client";


export const GetUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new Error('User not found in request. Make sure JWT authentication guard is applied.');
    }

    if (data) {
      return user[data];
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  },
);