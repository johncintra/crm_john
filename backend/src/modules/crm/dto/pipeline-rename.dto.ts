import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class PipelineRenameDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}
