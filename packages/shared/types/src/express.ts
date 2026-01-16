import { RequestUser, JWTPayload } from './user';

// Each service defines its own Tenant type locally
// This base declaration allows any tenant shape
declare global {
  namespace Express {
    interface Request {
      tenant?: any;  // Services cast to their own Tenant type
      user?: RequestUser;
      jwtPayload?: JWTPayload;
    }
  }
}

export {};
