-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "wasCheckoutOpportunity" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: any checkout lead that ever received more than one webhook
-- event almost certainly passed through a non-approved stage (Pix Gerado,
-- Boleto Gerado, etc) before becoming approved, so it should keep showing
-- up in the pinned "Compra Aprovada" column. Leads with exactly one event
-- were approved on their very first webhook (renewals, instant launch
-- sales) and stay false, which is the new desired default.
UPDATE "Lead" SET "wasCheckoutOpportunity" = true
WHERE id IN (
  SELECT "leadId" FROM "CheckoutEvent" GROUP BY "leadId" HAVING COUNT(*) > 1
);
