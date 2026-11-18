import { Global, Module } from '@nestjs/common';
import { MysqlService } from './mysql.service';
import { StaffAuthService } from './staff-auth.service';

/** Shared MySQL pool + Laravel-JWT staff auth, available to every feature module. */
@Global()
@Module({
  providers: [MysqlService, StaffAuthService],
  exports: [MysqlService, StaffAuthService],
})
export class CoreModule {}
