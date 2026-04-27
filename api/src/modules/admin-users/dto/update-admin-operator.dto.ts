import { Transform } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ADMIN_PAGE_KEYS } from '../../../common/admin-page-keys';

const PAGE_CHOICES = [...ADMIN_PAGE_KEYS];

export class UpdateAdminOperatorDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  login?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  position?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsIn(PAGE_CHOICES, { each: true })
  allowedPages?: string[];
}
