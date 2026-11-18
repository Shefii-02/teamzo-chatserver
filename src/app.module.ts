import { Controller, Get, Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { StaffNotifyModule } from './staff-notify/staff-notify.module';
import { WidgetChatModule } from './widget-chat/widget-chat.module';

@Controller('health')
class HealthController {
  @Get()
  health() {
    return { status: 'ok' };
  }
}

@Module({
  imports: [CoreModule, StaffNotifyModule, WidgetChatModule],
  controllers: [HealthController],
})
export class AppModule {}
