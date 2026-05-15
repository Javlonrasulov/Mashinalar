import { SetMetadata } from '@nestjs/common';
import type { AdminPageKey } from '../admin-page-keys';

export const ADMIN_ROUTE_PAGE_KEY = 'adminRoutePage';

/** @Roles(ADMIN) endpointlari uchun: OPERATOR bu kalit bo‘yicha ruxsat tekshiriladi */
export const AdminRoutePage = (page: AdminPageKey) =>
  SetMetadata(ADMIN_ROUTE_PAGE_KEY, page);

/** OPERATOR allowedPages ichida quyidagilardan kamida bittasi bo‘lsa kirish mumkin */
export const AdminRoutePageAny = (pages: readonly AdminPageKey[]) =>
  SetMetadata(ADMIN_ROUTE_PAGE_KEY, [...pages] as AdminPageKey[]);
