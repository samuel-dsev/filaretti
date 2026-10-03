import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { CreateUserDto, UserListDto } from './dto';
import { AuthenticationGuard, Roles, RolesGuard } from './guards';
import type { AuthenticatedRequest } from './types';
import { safeUserSchema, userListSchema } from './responses';

@ApiTags('Administrative users')
@ApiCookieAuth('filaretti_access')
@Controller('admin/users')
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  @ApiOkResponse({ schema: userListSchema })
  list(@Query() query: UserListDto) {
    return this.auth.listUsers(query);
  }

  @Post()
  @ApiCreatedResponse({ schema: safeUserSchema })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  create(@Body() body: CreateUserDto, @Req() request: AuthenticatedRequest) {
    return this.auth.createUser(body, request.user.id);
  }

  @Post(':id/deactivate')
  @ApiCreatedResponse({ schema: safeUserSchema })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  deactivate(@Param('id', ParseUUIDPipe) id: string, @Req() request: AuthenticatedRequest) {
    return this.auth.deactivateUser(id, request.user.id);
  }
}
