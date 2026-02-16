import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readConfig, upsertConfig } from '../api';
import type { Client } from '../api/client';
import type { DistributionConfig } from './types';
import type { Settings } from '../utils/settings';

interface BootstrapLogger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

interface ApplyDistributionBootstrapArgs {
  client: Client;
  distributionConfig: DistributionConfig;
  getSettings: () => Settings;
  updateSettings: (modifier: (settings: Settings) => void) => void;
  logger: BootstrapLogger;
}

const readConfigValue = async (
  client: Client,
  key: string,
  isSecret: boolean
): Promise<unknown | null> => {
  const response = await readConfig({
    client,
    body: {
      key,
      is_secret: isSecret,
    },
    throwOnError: true,
  });

  return response.data ?? null;
};

const getStringValue = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
};

const hasSecretValue = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'object' && value !== null && 'masked_value' in value) {
    const masked = (value as { masked_value?: unknown }).masked_value;
    return typeof masked === 'string' && masked.length > 0;
  }

  return false;
};

const writeProviderDefinition = async (distributionConfig: DistributionConfig): Promise<void> => {
  const provider = distributionConfig.provider;
  if (!provider) {
    return;
  }

  const customProvidersDir = path.join(os.homedir(), '.config', 'goose', 'custom_providers');
  const providerPath = path.join(customProvidersDir, `${provider.id}.json`);

  if (fsSync.existsSync(providerPath)) {
    return;
  }

  await fs.mkdir(customProvidersDir, { recursive: true });

  const providerConfig = {
    name: provider.id,
    engine: provider.engine,
    display_name: provider.display_name,
    description: `${provider.display_name} OpenAI-compatible endpoint`,
    api_key_env: provider.api_key_env,
    base_url: provider.base_url,
    models: [
      {
        name: provider.model,
        context_limit: provider.context_limit ?? 128000,
      },
    ],
    supports_streaming: provider.supports_streaming ?? true,
    requires_auth: provider.requires_auth ?? true,
  };

  await fs.writeFile(providerPath, `${JSON.stringify(providerConfig, null, 2)}\n`, 'utf8');
};

export const applyDistributionBootstrap = async ({
  client,
  distributionConfig,
  getSettings,
  updateSettings,
  logger,
}: ApplyDistributionBootstrapArgs): Promise<void> => {
  if (distributionConfig.bootstrap_enabled === false) {
    return;
  }

  const provider = distributionConfig.provider;
  if (!provider) {
    return;
  }

  const settings = getSettings();
  const existingBootstrap = settings.distributionBootstrap?.[distributionConfig.distro_id];

  if (
    existingBootstrap?.applied === true &&
    existingBootstrap.version === distributionConfig.distro_version
  ) {
    return;
  }

  await writeProviderDefinition(distributionConfig);

  const currentProviderRaw = await readConfigValue(client, 'GOOSE_PROVIDER', false);
  const currentModelRaw = await readConfigValue(client, 'GOOSE_MODEL', false);

  const currentProvider = getStringValue(currentProviderRaw);
  const currentModel = getStringValue(currentModelRaw);

  const shouldSetProvider = !currentProvider;
  const shouldSetModel = shouldSetProvider || currentProvider === provider.id;

  if (shouldSetProvider) {
    await upsertConfig({
      client,
      body: {
        key: 'GOOSE_PROVIDER',
        value: provider.id,
        is_secret: false,
      },
      throwOnError: true,
    });
  }

  if (shouldSetModel && !currentModel) {
    await upsertConfig({
      client,
      body: {
        key: 'GOOSE_MODEL',
        value: provider.model,
        is_secret: false,
      },
      throwOnError: true,
    });
  }

  const configuredProvider = shouldSetProvider ? provider.id : currentProvider;

  if (configuredProvider === provider.id && provider.api_key) {
    const secretRaw = await readConfigValue(client, provider.api_key_env, true);
    if (!hasSecretValue(secretRaw)) {
      await upsertConfig({
        client,
        body: {
          key: provider.api_key_env,
          value: provider.api_key,
          is_secret: true,
        },
        throwOnError: true,
      });
    }
  }

  updateSettings((currentSettings) => {
    const bootstrapState = currentSettings.distributionBootstrap || {};
    bootstrapState[distributionConfig.distro_id] = {
      applied: true,
      version: distributionConfig.distro_version,
      appliedAt: new Date().toISOString(),
    };

    currentSettings.distributionBootstrap = bootstrapState;
  });

  logger.info(
    `[distribution] Applied bootstrap for ${distributionConfig.distro_id} v${distributionConfig.distro_version}`
  );
};
