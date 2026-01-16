import { Tenant } from './tenant';
import { RequestUser, JWTPayload } from './user';

declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
      user?: RequestUser;
      jwtPayload?: JWTPayload;
    }
  }
}

export {};
