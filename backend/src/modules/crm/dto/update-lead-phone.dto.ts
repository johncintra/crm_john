import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateLeadPhoneDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone!: string;
}
