import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class PipelineCreateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}
