import { ArrayMinSize, IsArray, IsIn, IsString, MinLength } from 'class-validator';
import { ADMIN_PAGE_KEYS } from '../../../common/admin-page-keys';

const PAGE_CHOICES = [...ADMIN_PAGE_KEYS];

export class CreateAdminOperatorDto {
  @IsString()
  @MinLength(2)
  login!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @MinLength(1)
  position!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsIn(PAGE_CHOICES, { each: true })
  allowedPages!: string[];
}
