import { Tenant } from './tenant';
import { User, JWTPayload } from './user';

declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
      user?: User;
      jwtPayload?: JWTPayload;
    }
  }
}

export {};
