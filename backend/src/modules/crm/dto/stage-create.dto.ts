import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class StageCreateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @IsString()
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string;
}
