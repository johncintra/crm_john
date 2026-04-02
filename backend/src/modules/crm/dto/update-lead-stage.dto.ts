import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateLeadStageDto {
  @IsString()
  @IsNotEmpty()
  stageId!: string;
}
