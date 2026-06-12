import { IsNotEmpty, IsString } from 'class-validator';

export class StagesReorderDto {
  @IsString()
  @IsNotEmpty()
  stageId!: string;

  @IsString()
  @IsNotEmpty()
  targetStageId!: string;
}
