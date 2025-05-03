import dotenv from 'dotenv';
import path from 'path';
import { configManager } from "./configManager";
import { Config } from "@/types/modules/config";

// Load environment variables from .env file
dotenv.config();

// Export the configuration type
export type { Config };

// Export the current configuration
export default configManager.getConfig(); 