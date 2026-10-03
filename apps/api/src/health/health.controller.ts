import { Controller, Get, Header, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService } from './health.service';

@ApiTags('Operação')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Conectividade com PostgreSQL; sem conteúdo de domínio' })
  @ApiResponse({ status: 200, description: 'Banco disponível' })
  @ApiResponse({ status: 503, description: 'Banco indisponível' })
  async check(@Res({ passthrough: true }) response: Response) {
    const result = await this.health.check();
    response.status(result.database === 'up' ? 200 : 503);
    return result;
  }
}
