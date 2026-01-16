export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  GUEST = 'GUEST',
}

// Simplified User for Request context (used in Express.Request.user)
export interface RequestUser {
  id: string;
  tenantId: string;
  email: string;
  role: UserRole | string;
}

// Full User model for Auth Service
export interface User {
  id: string;
  tenantId: string;
  email: string;
  username: string;
  role: UserRole;
  profileImage?: string;
  isEmailVerified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterDTO {
  email: string;
  password: string;
  username: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface GoogleLoginDTO {
  googleToken: string;
}

export interface UpdateUserDTO {
  username?: string;
  profileImage?: string;
  role?: UserRole;
}

export interface JWTPayload {
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string;
}
