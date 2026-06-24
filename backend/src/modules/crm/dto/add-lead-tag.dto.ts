import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AddLeadTagDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  color?: string;
}
