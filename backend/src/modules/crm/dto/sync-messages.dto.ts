import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';

export class SyncMessageItemDto {
  @IsIn(['INBOUND', 'OUTBOUND'])
  direction!: 'INBOUND' | 'OUTBOUND';

  @IsString()
  @MaxLength(8000)
  content!: string;

  @IsISO8601()
  sentAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalId?: string;
}

export class SyncMessagesDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SyncMessageItemDto)
  messages!: SyncMessageItemDto[];
}
