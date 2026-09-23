import { IsOptional, IsString, MaxLength } from 'class-validator';

// Empty/missing email clears the field — same "blank means unset"
// convention as the rest of the free-text lead fields.
export class UpdateLeadReferredByDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;
}
