import { SetMetadata } from '@nestjs/common';
import type { AdminPageKey } from '../admin-page-keys';

export const ADMIN_ROUTE_PAGE_KEY = 'adminRoutePage';

/** @Roles(ADMIN) endpointlari uchun: OPERATOR bu kalit bo‘yicha ruxsat tekshiriladi */
export const AdminRoutePage = (page: AdminPageKey) => SetMetadata(ADMIN_ROUTE_PAGE_KEY, page);
