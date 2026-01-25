import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ClosetService } from './closet.service';
import { CreateClosetDto } from './dto/create-closet.dto';
import { UpdateClosetDto } from './dto/update-closet.dto';

@Controller('closet')
export class ClosetController {
  constructor(private readonly closetService: ClosetService) {}

  @Post()
  create(@Body() createClosetDto: CreateClosetDto) {
    return this.closetService.create(createClosetDto);
  }

  @Get(':userId')
  findByUserId(@Param('userId') userId: string) {
    return this.closetService.findByUserId(userId);
  }

  @Get()
  findAll() {
    return this.closetService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.closetService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateClosetDto: UpdateClosetDto) {
    return this.closetService.update(id, updateClosetDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.closetService.remove(id);
  }
}
