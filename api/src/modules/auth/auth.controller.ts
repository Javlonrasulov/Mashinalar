import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import {
  CurrentUser,
  JwtUser,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { sessionTouchFromRequest } from '../../common/session-device';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { UpdateCredentialsDto } from './dto/update-credentials.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, sessionTouchFromRequest(req));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtUser) {
    return this.auth.me(user.userId);
  }

  @Patch('credentials')
  @UseGuards(JwtAuthGuard)
  updateCredentials(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateCredentialsDto,
  ) {
    return this.auth.updateCredentials(user.userId, dto);
  }
}
