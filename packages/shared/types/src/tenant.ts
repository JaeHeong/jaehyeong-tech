export interface Tenant {
  id: string;
  name: string;
  domain: string;
  jwtSecret: string;
  jwtExpiry: string;
  passwordPolicy: PasswordPolicy;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

export interface CreateTenantDTO {
  name: string;
  domain: string;
  jwtExpiry?: string;
  passwordPolicy?: Partial<PasswordPolicy>;
}

export interface UpdateTenantDTO {
  domain?: string;
  jwtExpiry?: string;
  passwordPolicy?: Partial<PasswordPolicy>;
  isActive?: boolean;
}
