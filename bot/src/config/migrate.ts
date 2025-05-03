import fs from "fs";
import { configManager } from "./configManager";
import { ConfigVersion } from "@/types/modules/config";
import logger from "../utils/observability/logger";

export async function migrateConfigFile(configPath: string): Promise<void> {
  try {
    // Read existing config file
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const lines = configContent.split('\n');

    // Parse existing config
    const existingConfig: Record<string, string> = {};
    lines.forEach(line => {
      if (line.trim() && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          existingConfig[key.trim()] = valueParts.join('=').trim();
        }
      }
    });

    // Get current version
    const currentVersion = existingConfig['CONFIG_VERSION'] || ConfigVersion.V1_0_0;

    if (currentVersion === ConfigVersion.CURRENT) {
      logger.info('Config file is already at the latest version', { version: currentVersion });
      return;
    }

    // Create backup
    const backupPath = `${configPath}.${Date.now()}.bak`;
    fs.copyFileSync(configPath, backupPath);
    logger.info('Created backup of config file', { backupPath });

    // Migrate config
    const migratedConfig = configManager['migrateConfig'](existingConfig);

    // Write new config file
    const newLines = [
      `# Minecraft Bot Configuration`,
      `# Version: ${ConfigVersion.CURRENT}`,
      `# Last migrated: ${new Date().toISOString()}`,
      `# Original version: ${currentVersion}`,
      ``,
    ];

    // Add all config values
    Object.entries(migratedConfig).forEach(([key, value]) => {
      if (key !== 'CONFIG_VERSION') {
        newLines.push(`${key}=${value}`);
      }
    });

    // Add version at the end
    newLines.push(`\nCONFIG_VERSION=${ConfigVersion.CURRENT}`);

    // Write new config file
    fs.writeFileSync(configPath, newLines.join('\n'));

    logger.info('Successfully migrated config file', {
      fromVersion: currentVersion,
      toVersion: ConfigVersion.CURRENT,
      backupPath
    });

  } catch (error) {
    logger.error('Failed to migrate config file', { error });
    throw error;
  }
}

// Command line interface
if (require.main === module) {
  const configPath = process.argv[2] || '.env';

  if (!fs.existsSync(configPath)) {
    logger.error('Config file not found', { path: configPath });
    process.exit(1);
  }

  migrateConfigFile(configPath)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 