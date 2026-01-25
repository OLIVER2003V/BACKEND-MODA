import { Body, Controller, Param, Patch } from '@nestjs/common';
import { UsersService } from './users.service';
import { RegisterFcmTokenDto } from './dto/register-fcm-token.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('register-fcm/:userId')
  registerFcmToken(
    @Body() registerFcmTokenDto: RegisterFcmTokenDto,
    @Param('userId') userId: string,
  ) {
    return this.usersService.registerFcmToken(userId, registerFcmTokenDto);
  }
}
