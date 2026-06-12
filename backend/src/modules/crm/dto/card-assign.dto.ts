import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CardAssignDto {
  @IsString()
  @IsNotEmpty()
  stageId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;
}
