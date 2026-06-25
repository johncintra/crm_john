-- CreateTable
CREATE TABLE "Macro" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "shortcut" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Macro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Macro_workspaceId_idx" ON "Macro"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Macro_workspaceId_shortcut_key" ON "Macro"("workspaceId", "shortcut");

-- AddForeignKey
ALTER TABLE "Macro" ADD CONSTRAINT "Macro_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
