import { IsIn, IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export const AVATAR_STYLES = [
  'adventurer',
  'avataaars',
  'big-ears',
  'lorelei',
  'micah',
  'notionists',
  'open-peeps',
  'personas',
] as const

export type AvatarStyle = (typeof AVATAR_STYLES)[number]

export class SetAvatarDto {
  @ApiProperty({
    enum: AVATAR_STYLES,
    description: 'Estilo de avatar de DiceBear',
    example: 'adventurer',
  })
  @IsString()
  @IsIn(AVATAR_STYLES)
  style: AvatarStyle
}
