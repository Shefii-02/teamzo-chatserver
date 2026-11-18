import { Module } from '@nestjs/common';
import { StaffNotifyModule } from '../staff-notify/staff-notify.module';
import { StaffJwtGuard } from './staff-jwt.guard';
import { WidgetChatController } from './widget-chat.controller';
import { WidgetChatService } from './widget-chat.service';

@Module({
  imports: [StaffNotifyModule],
  controllers: [WidgetChatController],
  providers: [WidgetChatService, StaffJwtGuard],
})
export class WidgetChatModule {}
