// Built programmatically by mapZapSignWebhookPayload from the raw ZapSign
// payload (not bound directly to @Body(), so no class-validator decorators
// — same approach as the Kiwify/ActiveCampaign mappers).
export class ZapSignSignerDto {
  phone!: string;
  email?: string;
  cpf?: string;
  documentName?: string;
  documentToken?: string;
}
