import { IsIn, IsOptional, IsString } from 'class-validator';
import { TaskStatus } from '@prisma/client';

export class ReviewTaskDto {
  @IsString()
  @IsIn(['APPROVED', 'REJECTED'])
  status!: Extract<TaskStatus, 'APPROVED' | 'REJECTED'>;
}
