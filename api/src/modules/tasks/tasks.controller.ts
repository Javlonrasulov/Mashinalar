import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { AdminRoutePage } from '../../common/decorators/admin-route-page.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateTaskDto } from './dto/create-task.dto';
import { ReviewTaskDto } from './dto/review-task.dto';
import { TasksService } from './tasks.service';

const uploadDir = join(process.cwd(), 'uploads');

function ensureUploadDir() {
  if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
}

function fileName(_req: unknown, file: Express.Multer.File, cb: (e: Error | null, name: string) => void) {
  const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
  cb(null, name);
}

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('TASKS')
  findAllAdmin() {
    return this.tasks.findAllAdmin();
  }

  @Get('mine')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER)
  findMine(@CurrentUser() user: JwtUser) {
    if (!user.driverId) throw new BadRequestException('No driver');
    return this.tasks.findMine(user.driverId);
  }

  @Get('mine/active')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER)
  findMineActive(@CurrentUser() user: JwtUser) {
    if (!user.driverId) throw new BadRequestException('No driver');
    return this.tasks.findMineActive(user.driverId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('TASKS')
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: JwtUser) {
    return this.tasks.create(dto, user.userId);
  }

  @Patch(':id/submit')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER)
  @UseInterceptors(
    FileInterceptor('proofPhoto', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          ensureUploadDir();
          cb(null, uploadDir);
        },
        filename: fileName,
      }),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  submit(
    @Param('id') id: string,
    @Body() body: { proofText?: string },
    @UploadedFile() proofPhoto: Express.Multer.File | undefined,
    @CurrentUser() user: JwtUser,
  ) {
    if (!user.driverId) throw new BadRequestException('No driver');
    const proofPhotoUrl = proofPhoto ? `/uploads/${proofPhoto.filename}` : undefined;
    return this.tasks.submit(id, user.driverId, { proofText: body.proofText, proofPhotoUrl }, user.userId);
  }

  @Patch(':id/review')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('TASKS')
  review(@Param('id') id: string, @Body() dto: ReviewTaskDto, @CurrentUser() user: JwtUser) {
    return this.tasks.review(id, dto.status, user.userId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('TASKS')
  remove(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.tasks.remove(id, user.userId, UserRole.ADMIN);
  }
}
