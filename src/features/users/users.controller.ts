import {
  Body, Controller, Delete, Param, Patch, Post,
  UploadedFile, UseInterceptors,
  ParseFilePipe, FileTypeValidator, MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { RegisterFcmTokenDto } from './dto/register-fcm-token.dto';
import { SetAvatarDto } from './dto/set-avatar.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('register-fcm/:userId')
  @ApiOperation({ summary: 'Registrar token FCM del dispositivo' })
  registerFcmToken(
    @Body() registerFcmTokenDto: RegisterFcmTokenDto,
    @Param('userId') userId: string,
  ) {
    return this.usersService.registerFcmToken(userId, registerFcmTokenDto);
  }

  // ── Profile photo ──────────────────────────────────────────────────────────

  @Post(':userId/photo')
  @ApiOperation({ summary: 'Subir o reemplazar foto de perfil' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Foto de perfil (jpg/png/webp, max 5 MB)' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadProfilePhoto(
    @Param('userId') userId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/i }),
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5 MB
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.usersService.uploadProfilePhoto(userId, file);
  }

  @Delete(':userId/photo')
  @ApiOperation({ summary: 'Eliminar foto de perfil' })
  removeProfilePhoto(@Param('userId') userId: string) {
    return this.usersService.removeProfilePhoto(userId);
  }

  // ── Avatar ─────────────────────────────────────────────────────────────────

  @Patch(':userId/avatar')
  @ApiOperation({ summary: 'Elegir estilo de avatar (reemplaza la foto de perfil)' })
  setAvatar(
    @Param('userId') userId: string,
    @Body() dto: SetAvatarDto,
  ) {
    return this.usersService.setAvatar(userId, dto);
  }
}
