import { IsNotEmpty, IsString } from 'class-validator';

export class CardMoveDto {
  @IsString()
  @IsNotEmpty()
  stageId!: string;
}
