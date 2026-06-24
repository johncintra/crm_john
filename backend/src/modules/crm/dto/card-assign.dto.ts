import { IsArray, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min, MaxLength } from 'class-validator';

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

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagIds?: string[];

  // Order snapshot — lets a card dragged in from a checkout-sourced pinned
  // column (Oportunidades/Compra Aprovada) keep showing its value/product
  // even though the destination is a separate Lead row with no Order of
  // its own.
  @IsInt()
  @Min(0)
  @IsOptional()
  originAmount?: number;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  originCurrency?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  originProductName?: string;

  @IsIn(['OPEN', 'ABANDONED', 'PENDING', 'APPROVED', 'DECLINED', 'REFUNDED', 'CHARGEBACK'])
  @IsOptional()
  originOrderStatus?: string;
}
