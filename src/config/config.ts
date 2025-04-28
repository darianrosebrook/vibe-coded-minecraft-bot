import { configManager } from "./configManager";
import { Config } from "@/types";

// Export the configuration type
export type { Config };

// Export the current configuration
export default configManager.getConfig(); 