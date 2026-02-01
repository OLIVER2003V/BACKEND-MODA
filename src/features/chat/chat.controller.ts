import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatService } from './chat.service';
import { StartConversationDto, SendMessageDto } from './dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('conversations')
  async startConversation(@Body() dto: StartConversationDto) {
    return this.chatService.startConversation(dto.userId);
  }

  @Get('conversations/:userId')
  async getConversationsByUser(@Param('userId') userId: string) {
    return this.chatService.getConversationsByUser(userId);
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(id, dto.content);
  }

  @Post('conversations/:id/face-image')
  @UseInterceptors(FileInterceptor('file'))
  async sendFaceImage(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/i }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.chatService.handleFaceImage(id, file);
  }
}
