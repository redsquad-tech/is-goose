export type DistributionLocale = 'en' | 'ru';

export interface DistributionBrandingConfig {
  app_name: string;
  short_name?: string;
  protocol?: string;
}

export interface DistributionLocaleConfig {
  default?: DistributionLocale;
}

export interface DistributionProviderConfig {
  id: string;
  display_name: string;
  engine: 'openai';
  base_url: string;
  model: string;
  api_key_env: string;
  api_key?: string;
  supports_streaming?: boolean;
  requires_auth?: boolean;
  context_limit?: number;
}

export interface DistributionConfig {
  distro_id: string;
  distro_version: number;
  bootstrap_enabled?: boolean;
  branding?: DistributionBrandingConfig;
  locale?: DistributionLocaleConfig;
  provider?: DistributionProviderConfig;
}
