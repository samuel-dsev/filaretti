import { DynamicModule, Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type { ApiEnvironment } from '@filaretti/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthenticationGuard, PreloginMutationGuard, RolesGuard } from './guards';
import { DeferredRecoveryDelivery, PasswordRecoveryService } from './recovery.service';
import { AUTH_ENVIRONMENT, RECOVERY_DELIVERY, type PasswordRecoveryDelivery } from './types';
import { UsersController } from './users.controller';

@Global()
@Module({})
export class AuthModule {
  static register(
    environment: ApiEnvironment,
    recoveryDelivery: PasswordRecoveryDelivery = new DeferredRecoveryDelivery(),
  ): DynamicModule {
    return {
      module: AuthModule,
      imports: [JwtModule.register({})],
      controllers: [AuthController, UsersController],
      providers: [
        { provide: AUTH_ENVIRONMENT, useValue: environment },
        { provide: RECOVERY_DELIVERY, useValue: recoveryDelivery },
        AuthService,
        PasswordRecoveryService,
        AuthenticationGuard,
        RolesGuard,
        PreloginMutationGuard,
      ],
      exports: [AuthService, PasswordRecoveryService, AuthenticationGuard, RolesGuard],
    };
  }
}
