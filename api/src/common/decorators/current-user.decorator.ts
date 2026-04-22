import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type JwtUser = {
  userId: string;
  role: string;
  driverId?: string;
};

export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext): JwtUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user as JwtUser;
});
