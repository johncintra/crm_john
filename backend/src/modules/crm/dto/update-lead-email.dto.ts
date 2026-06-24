import { IsEmail, IsNotEmpty } from 'class-validator';

export class UpdateLeadEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
