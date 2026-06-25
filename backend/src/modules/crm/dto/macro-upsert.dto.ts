import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class MacroUpsertDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  shortcut!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;
}
