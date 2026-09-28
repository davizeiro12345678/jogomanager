import type { ComponentType } from "react";

// Each template declares its own prop shape (e.g. SignupEmailProps), so the
// registry cannot be narrowed to a single shared props type without rejecting
// valid registrations. The props stay intentionally open here and are validated
// at the registration/render call sites.
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface TemplateEntry {
  component: ComponentType<any>;
  subject: string | ((data: Record<string, any>) => string);
  displayName?: string;
  previewData?: Record<string, any>;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  // Add templates here as they are created, e.g.:
  // 'welcome': welcomeTemplate,
};
