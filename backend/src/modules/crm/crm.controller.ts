import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';
import { CheckoutProvider, OrderStatus } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { CrmService } from './crm.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { IngestCheckoutEventDto } from './dto/ingest-checkout-event.dto';
import { UpdateLeadStageDto } from './dto/update-lead-stage.dto';
import { UpdateLeadPhoneDto } from './dto/update-lead-phone.dto';
import { UpdateLeadEmailDto } from './dto/update-lead-email.dto';
import { UpdateLeadValueDto } from './dto/update-lead-value.dto';
import { AddLeadTagDto } from './dto/add-lead-tag.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { PipelineCreateDto } from './dto/pipeline-create.dto';
import { PipelineRenameDto } from './dto/pipeline-rename.dto';
import { StageCreateDto } from './dto/stage-create.dto';
import { StageUpdateDto } from './dto/stage-update.dto';
import { StagesReorderDto } from './dto/stages-reorder.dto';
import { CardAssignDto } from './dto/card-assign.dto';
import { CardMoveDto } from './dto/card-move.dto';
import { SyncMessagesDto } from './dto/sync-messages.dto';

@Controller()
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @UseGuards(JwtAuthGuard)
  @Get('leads/by-phone/:phone')
  findLeadByPhone(@CurrentUser() user: AuthUser, @Param('phone') phone: string) {
    return this.crmService.findLeadByPhone(user.sub, phone);
  }

  @UseGuards(JwtAuthGuard)
  @Get('leads/:leadId')
  getLeadById(@CurrentUser() user: AuthUser, @Param('leadId') leadId: string) {
    return this.crmService.getLeadById(user.sub, leadId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('leads/:leadId/timeline')
  getLeadTimeline(@CurrentUser() user: AuthUser, @Param('leadId') leadId: string) {
    return this.crmService.getLeadTimeline(user.sub, leadId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('leads/:leadId/notes')
  getLeadNotes(@CurrentUser() user: AuthUser, @Param('leadId') leadId: string) {
    return this.crmService.getLeadNotes(user.sub, leadId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('leads/:leadId/notes')
  addLeadNote(
    @CurrentUser() user: AuthUser,
    @Param('leadId') leadId: string,
    @Body() dto: CreateNoteDto
  ) {
    return this.crmService.addLeadNote(user.sub, leadId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('leads/:leadId/tasks')
  getLeadTasks(@CurrentUser() user: AuthUser, @Param('leadId') leadId: string) {
    return this.crmService.getLeadTasks(user.sub, leadId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('leads/:leadId/tasks')
  createLeadTask(
    @CurrentUser() user: AuthUser,
    @Param('leadId') leadId: string,
    @Body() dto: CreateTaskDto
  ) {
    return this.crmService.createLeadTask(user.sub, leadId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('leads/:leadId/messages')
  getLeadMessages(
    @CurrentUser() user: AuthUser,
    @Param('leadId') leadId: string,
    @Query('hours') hours?: string
  ) {
    const sinceHours = Number(hours) > 0 ? Number(hours) : 24;
    return this.crmService.getLeadMessages(user.sub, leadId, sinceHours);
  }

  @UseGuards(JwtAuthGuard)
  @Post('leads/:leadId/messages/sync')
  syncLeadMessages(
    @CurrentUser() user: AuthUser,
    @Param('leadId') leadId: string,
    @Body() dto: SyncMessagesDto
  ) {
    return this.crmService.syncLeadMessages(user.sub, leadId, dto.messages);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('leads/:leadId/phone')
  updateLeadPhone(
    @CurrentUser() user: AuthUser,
    @Param('leadId') leadId: string,
    @Body() dto: UpdateLeadPhoneDto
  ) {
    return this.crmService.updateLeadPhone(user.sub, leadId, dto.phone);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('leads/:leadId/email')
  updateLeadEmail(
    @CurrentUser() user: AuthUser,
    @Param('leadId') leadId: string,
    @Body() dto: UpdateLeadEmailDto
  ) {
    return this.crmService.updateLeadEmail(user.sub, leadId, dto.email);
  }

  @UseGuards(JwtAuthGuard)
  @Post('leads/:leadId/tags')
  addLeadTag(
    @CurrentUser() user: AuthUser,
    @Param('leadId') leadId: string,
    @Body() dto: AddLeadTagDto
  ) {
    return this.crmService.addLeadTag(user.sub, leadId, dto.name, dto.color);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('leads/:leadId/tags/:tagId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeLeadTag(
    @CurrentUser() user: AuthUser,
    @Param('leadId') leadId: string,
    @Param('tagId') tagId: string
  ) {
    return this.crmService.removeLeadTag(user.sub, leadId, tagId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('leads/:leadId/value')
  updateLeadValue(
    @CurrentUser() user: AuthUser,
    @Param('leadId') leadId: string,
    @Body() dto: UpdateLeadValueDto
  ) {
    return this.crmService.updateLeadValue(user.sub, leadId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('workspace/tags')
  listWorkspaceTags(@CurrentUser() user: AuthUser) {
    return this.crmService.listWorkspaceTags(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('leads/:leadId/stage')
  updateLeadStage(
    @CurrentUser() user: AuthUser,
    @Param('leadId') leadId: string,
    @Body() dto: UpdateLeadStageDto
  ) {
    return this.crmService.updateLeadStage(user.sub, leadId, dto.stageId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('pipelines/default')
  getDefaultPipeline(@CurrentUser() user: AuthUser) {
    return this.crmService.getDefaultPipeline(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('pipelines/checkout/board')
  getCheckoutBoard(@CurrentUser() user: AuthUser) {
    return this.crmService.getCheckoutBoard(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('templates')
  listTemplates(@CurrentUser() user: AuthUser) {
    return this.crmService.listTemplates(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('tasks/:taskId/status')
  updateTaskStatus(
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskStatusDto
  ) {
    return this.crmService.updateTaskStatus(user.sub, taskId, dto.status);
  }

  @UseGuards(JwtAuthGuard)
  @Get('pipelines')
  listPipelines(@CurrentUser() user: AuthUser) {
    return this.crmService.listPipelines(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('pipelines')
  createPipeline(@CurrentUser() user: AuthUser, @Body() dto: PipelineCreateDto) {
    return this.crmService.createPipeline(user.sub, dto.name);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('pipelines/:id')
  renamePipeline(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: PipelineRenameDto) {
    return this.crmService.renamePipeline(user.sub, id, dto.name);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('pipelines/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePipeline(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.crmService.deletePipeline(user.sub, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('pipelines/:id/board')
  getPipelineBoard(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.crmService.getPipelineBoard(user.sub, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('pipelines/:id/stages')
  createStage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: StageCreateDto) {
    return this.crmService.createStage(user.sub, id, dto.name, dto.color ?? '#64748b');
  }

  @UseGuards(JwtAuthGuard)
  @Patch('pipelines/:id/stages/:stageId')
  updateStage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('stageId') stageId: string,
    @Body() dto: StageUpdateDto
  ) {
    return this.crmService.updateStage(user.sub, id, stageId, dto.name, dto.color ?? '#64748b');
  }

  @UseGuards(JwtAuthGuard)
  @Delete('pipelines/:id/stages/:stageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteStage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('stageId') stageId: string) {
    return this.crmService.deleteStage(user.sub, id, stageId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('pipelines/:id/stages/reorder')
  reorderStages(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: StagesReorderDto) {
    return this.crmService.reorderStages(user.sub, id, dto.stageId, dto.targetStageId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('pipelines/:id/cards')
  assignContact(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CardAssignDto) {
    return this.crmService.assignContactToStage(user.sub, id, dto.stageId, {
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      tagIds: dto.tagIds,
      originAmount: dto.originAmount,
      originCurrency: dto.originCurrency,
      originProductName: dto.originProductName,
      originOrderStatus: dto.originOrderStatus as OrderStatus | undefined
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch('pipelines/:id/cards/:leadId/move')
  moveCard(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('leadId') leadId: string,
    @Body() dto: CardMoveDto
  ) {
    return this.crmService.moveCard(user.sub, id, leadId, dto.stageId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('pipelines/:id/cards/:leadId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCard(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('leadId') leadId: string) {
    return this.crmService.removeCard(user.sub, id, leadId);
  }

  @Post('webhooks/checkouts/:provider/:token')
  ingestCheckoutEvent(
    @Param('provider') provider: CheckoutProvider,
    @Param('token') token: string,
    @Body() dto: IngestCheckoutEventDto
  ) {
    return this.crmService.ingestCheckoutEvent(provider, token, dto);
  }

  @Post('webhooks/kiwify/:token')
  ingestKiwifyEvent(@Param('token') token: string, @Body() payload: Record<string, unknown>) {
    const dto = this.crmService.mapKiwifyWebhookPayload(payload);
    if (!dto.phone) {
      throw new BadRequestException('Phone is required in Kiwify payload.');
    }

    return this.crmService.ingestCheckoutEvent(CheckoutProvider.KIWIFY, token, dto);
  }

  @Post('webhooks/activecampaign/:token')
  ingestActiveCampaignEvent(@Param('token') token: string, @Body() payload: Record<string, unknown>) {
    const dto = this.crmService.mapActiveCampaignWebhookPayload(payload);
    if (!dto.phone) {
      throw new BadRequestException('Phone is required in ActiveCampaign payload.');
    }

    return this.crmService.ingestCheckoutEvent(CheckoutProvider.ACTIVECAMPAIGN, token, dto);
  }
}
