import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiCookieAuth,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { ApiEnvironment } from '@filaretti/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { clearSessionCookies, writeCsrfCookie, writeSessionCookies } from './cookies';
import { ChangePasswordDto, LoginDto, RecoveryRequestDto, RecoveryResetDto } from './dto';
import { AuthenticationGuard, PreloginMutationGuard } from './guards';
import { PasswordRecoveryService } from './recovery.service';
import { AUTH_ENVIRONMENT, type AuthenticatedRequest } from './types';
import { authenticationSchema, csrfSchema, recoverySchema, safeUserSchema } from './responses';
import { resolveClientIp } from '../common/client-ip';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly recovery: PasswordRecoveryService,
    @Inject(AUTH_ENVIRONMENT) private readonly environment: ApiEnvironment,
  ) {}

  @Get('csrf')
  @ApiOkResponse({ schema: csrfSchema })
  @ApiOperation({ summary: 'Obtém proteção CSRF antes do login ou restaura a da sessão atual' })
  async csrf(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const csrfToken = await this.auth.csrf(request);
    writeCsrfCookie(response, this.environment, csrfToken);
    return { csrfToken };
  }

  @Post('login')
  @ApiOkResponse({ schema: authenticationSchema })
  @HttpCode(200)
  @UseGuards(PreloginMutationGuard)
  @ApiHeader({ name: 'Origin', required: true })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const tokens = await this.auth.login(
      body.email,
      body.password,
      resolveClientIp(request, this.environment),
    );
    writeSessionCookies(response, this.environment, tokens);
    return { user: tokens.user, csrfToken: tokens.csrfToken };
  }

  @Post('refresh')
  @ApiOkResponse({ schema: authenticationSchema })
  @HttpCode(200)
  @ApiHeader({ name: 'Origin', required: true })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const tokens = await this.auth.refresh(request);
    writeSessionCookies(response, this.environment, tokens);
    return { user: tokens.user, csrfToken: tokens.csrfToken };
  }

  @Post('logout')
  @ApiNoContentResponse()
  @HttpCode(204)
  @UseGuards(AuthenticationGuard)
  @ApiCookieAuth('filaretti_access')
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(request.user.sessionId);
    clearSessionCookies(response, this.environment);
  }

  @Get('me')
  @ApiOkResponse({ schema: safeUserSchema })
  @UseGuards(AuthenticationGuard)
  @ApiCookieAuth('filaretti_access')
  me(@Req() request: AuthenticatedRequest) {
    return this.auth.me(request.user.id);
  }

  @Post('password')
  @ApiNoContentResponse()
  @HttpCode(204)
  @UseGuards(AuthenticationGuard)
  @ApiCookieAuth('filaretti_access')
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  async changePassword(
    @Body() body: ChangePasswordDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.changePassword(request.user.id, body.currentPassword, body.newPassword);
    clearSessionCookies(response, this.environment);
  }

  @Post('password/recovery')
  @ApiAcceptedResponse({ schema: recoverySchema })
  @HttpCode(202)
  @UseGuards(PreloginMutationGuard)
  @ApiHeader({ name: 'Origin', required: true })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiOperation({
    summary: 'Enfileira recuperação transacional sem revelar cadastro',
  })
  async recover(@Body() body: RecoveryRequestDto, @Req() request: Request) {
    await this.auth.consumeAttempt(
      'recovery',
      resolveClientIp(request, this.environment),
      body.email,
    );
    await this.recovery.request(body.email);
    return {
      message: 'Se a conta existir, receberá instruções quando a entrega estiver habilitada.',
    };
  }

  @Post('password/reset')
  @ApiNoContentResponse()
  @HttpCode(204)
  @UseGuards(PreloginMutationGuard)
  @ApiHeader({ name: 'Origin', required: true })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  async reset(@Body() body: RecoveryResetDto, @Req() request: Request): Promise<void> {
    await this.auth.consumeAttempt('reset', resolveClientIp(request, this.environment));
    await this.recovery.reset(body.token, body.newPassword);
  }
}
