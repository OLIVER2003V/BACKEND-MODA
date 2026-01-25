import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
} from '@nestjs/common';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from 'generated/prisma/client';

@Controller('post')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post()
  @Auth()
  create(@Body() createPostDto: CreatePostDto) {
    return this.postService.create(createPostDto);
  }

  @Get()
  findAll() {
    return this.postService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postService.findOne(id);
  }

  @Post(':id/react')
  @Auth()
  react(@Param('id') id: string, @GetUser() user: User) {
    return this.postService.react(id, user.id);
  }

  @Delete(':id/react')
  @Auth()
  unreact(@Param('id') id: string, @GetUser() user: User) {
    return this.postService.unreact(id, user.id);
  }

  @Get(':id/reactions')
  getReactions(@Param('id') id: string) {
    return this.postService.getReactions(id);
  }

  @Delete(':id')
  @Auth()
  remove(@Param('id') id: string) {
    return this.postService.remove(id);
  }
}
