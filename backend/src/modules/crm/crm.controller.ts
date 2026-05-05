import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from '@nestjs/common';
import { CheckoutProvider } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { CrmService } from './crm.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { IngestCheckoutEventDto } from './dto/ingest-checkout-event.dto';
import { UpdateLeadStageDto } from './dto/update-lead-stage.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';

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
}
