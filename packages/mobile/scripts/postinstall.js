#!/usr/bin/env node
/**
 * Post-install patches for React Native 0.83 compatibility.
 * These fix known issues in expo packages that haven't been updated yet.
 * Run automatically via npm postinstall or manually: node scripts/postinstall.js
 */
const fs = require("fs");
const path = require("path");

const nodeModules = path.resolve(__dirname, "..", "node_modules");

// Patch 1: expo-dev-menu-interface - fix ReactNativeFeatureFlags import for RN 0.83
const devMenuFile = path.join(
  nodeModules,
  "expo-dev-menu-interface/android/src/main/java/expo/interfaces/devmenu/ReactHostWrapper.kt"
);
if (fs.existsSync(devMenuFile)) {
  let content = fs.readFileSync(devMenuFile, "utf8");
  if (content.includes("expo.modules.rncompatibility.ReactNativeFeatureFlags")) {
    content = content.replace(
      "import expo.modules.rncompatibility.ReactNativeFeatureFlags",
      "import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags"
    );
    content = content.replace(
      /ReactNativeFeatureFlags\.enableBridgelessArchitecture(?!\()/g,
      "ReactNativeFeatureFlags.enableBridgelessArchitecture()"
    );
    fs.writeFileSync(devMenuFile, content);
    console.log("[postinstall] Patched expo-dev-menu-interface for RN 0.83");
  }
}

// Patch 2: expo-updates-interface - remove duplicate UpdatesInterfaceCallbacks
const updatesFile = path.join(
  nodeModules,
  "expo-updates-interface/android/src/main/java/expo/modules/updatesinterface/UpdatesInterface.kt"
);
if (fs.existsSync(updatesFile)) {
  let content = fs.readFileSync(updatesFile, "utf8");
  const matches = content.match(/interface UpdatesInterfaceCallbacks/g);
  if (matches && matches.length > 1) {
    // Remove the duplicate definition (the one after line 60)
    const lines = content.split("\n");
    const newLines = [];
    let skip = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === "interface UpdatesInterfaceCallbacks {" && i > 60) {
        skip = true;
        continue;
      }
      if (skip && lines[i].trim() === "}") {
        skip = false;
        continue;
      }
      if (skip) continue;
      newLines.push(lines[i]);
    }
    fs.writeFileSync(updatesFile, newLines.join("\n"));
    console.log("[postinstall] Patched expo-updates-interface duplicate interface");
  }
}

// Patch 3: Ensure react-native symlink exists at root for react-native-quick-crypto
const rootNodeModules = path.resolve(__dirname, "..", "..", "..", "node_modules");
const rnSymlink = path.join(rootNodeModules, "react-native");
const rnSource = path.join(nodeModules, "react-native");
if (fs.existsSync(rnSource) && !fs.existsSync(rnSymlink)) {
  try {
    fs.symlinkSync(rnSource, rnSymlink);
    console.log("[postinstall] Created react-native symlink at root node_modules");
  } catch (e) {
    // May fail if something else already exists there
    console.warn("[postinstall] Could not create react-native symlink:", e.message);
  }
}
