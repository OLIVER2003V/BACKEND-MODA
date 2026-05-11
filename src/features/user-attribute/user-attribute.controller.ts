import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { UserAttributeService } from './user-attribute.service';
import { CreateUserAttributeDto } from './dto/create-user-attribute.dto';
import { UpdateUserAttributeDto } from './dto/update-user-attribute.dto';

@Controller('user-attribute')
export class UserAttributeController {
  constructor(private readonly userAttributeService: UserAttributeService) {}

  @Post()
  create(@Body() createUserAttributeDto: CreateUserAttributeDto) {
    return this.userAttributeService.create(createUserAttributeDto);
  }

  @Get()
  findAll() {
    return this.userAttributeService.findAll();
  }

  // Ruta específica "by-user" antes de la genérica :id
  @Get('by-user/:userId')
  getByUserId(@Param('userId') userId: string) {
    return this.userAttributeService.findByUserId(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userAttributeService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserAttributeDto: UpdateUserAttributeDto) {
    return this.userAttributeService.update(id, updateUserAttributeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userAttributeService.remove(id);
  }
}
