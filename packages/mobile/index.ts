// MUST be first imports — polyfills for crypto
import "react-native-get-random-values";
import { install as installQuickCrypto } from "react-native-quick-crypto";
installQuickCrypto();

// Buffer polyfill for base64 operations
import { Buffer } from "buffer";
(globalThis as any).Buffer = Buffer;

// Now safe to register the app
import { registerRootComponent } from "expo";
import App from "./App";

registerRootComponent(App);
