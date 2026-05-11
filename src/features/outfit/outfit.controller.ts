import { Controller, Get, Post, Patch, Param, Delete, Body } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OutfitService } from './outfit.service';
import { UpdateOutfitDto } from './dto/update-outfit.dto';

@ApiTags('outfit')
@Controller('outfit')
export class OutfitController {
  constructor(private readonly outfitService: OutfitService) {}

  @Post('manual')
  @ApiOperation({ summary: 'Create outfit manually with selected garments' })
  createManual(@Body() dto: { name: string; garmentIds: string[] }) {
    return this.outfitService.createManual(dto.name, dto.garmentIds);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all outfits for a user' })
  findByUserId(@Param('userId') userId: string) {
    return this.outfitService.findByUserId(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get outfit by ID' })
  findOne(@Param('id') id: string) {
    return this.outfitService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update outfit name/description' })
  update(@Param('id') id: string, @Body() updateOutfitDto: UpdateOutfitDto) {
    return this.outfitService.update(id, updateOutfitDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete outfit' })
  remove(@Param('id') id: string) {
    return this.outfitService.remove(id);
  }
}
