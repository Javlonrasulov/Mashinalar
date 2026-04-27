import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminUsersService } from './admin-users.service';
import { CreateAdminOperatorDto } from './dto/create-admin-operator.dto';
import { UpdateAdminOperatorDto } from './dto/update-admin-operator.dto';

@Controller('admin-users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  list() {
    return this.adminUsers.listOperators();
  }

  @Post()
  create(@Body() dto: CreateAdminOperatorDto) {
    return this.adminUsers.create(dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateAdminOperatorDto) {
    return this.adminUsers.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.adminUsers.remove(user.userId, id);
  }
}
