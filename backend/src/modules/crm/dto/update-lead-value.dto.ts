import { IsInt, IsNotEmpty, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class UpdateLeadValueDto {
  @IsInt()
  @Min(0)
  @IsNotEmpty()
  amount!: number;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  currency?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  productName?: string;
}
