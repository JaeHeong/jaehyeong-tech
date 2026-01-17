/**
 * Tenant Resolver Middleware
 *
 * Re-exports from shared utils for backward compatibility.
 * Uses multi-source tenant resolution (JWT header, Host, env fallback).
 */
export { resolveTenant, optionalTenant, createTenantResolver } from '@shared/utils';
