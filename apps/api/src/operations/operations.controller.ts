import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuthenticationGuard, Roles, RolesGuard } from '../auth/guards';
import { OperationsService } from './operations.service';

@ApiTags('Operação privada')
@ApiCookieAuth('filaretti_access')
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/operations')
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  snapshot() {
    return this.operations.snapshot();
  }
}
