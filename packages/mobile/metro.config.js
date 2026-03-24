const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the monorepo root for changes in sibling packages (@noxu/core)
config.watchFolders = [monorepoRoot];

// Resolve modules from both the mobile package and monorepo root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Ensure @noxu/core resolves to the workspace package
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
