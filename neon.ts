import { defineConfig } from "@neon/config/v1";

// Neon project config. The app only uses Neon Postgres (every branch has it),
// so no extra services (auth, AI gateway, storage, functions, realtime) are declared.
// Add them here if the app starts using them, then run `neon deploy`.
export default defineConfig({
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
