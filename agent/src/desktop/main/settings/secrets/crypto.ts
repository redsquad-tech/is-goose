import { safeStorage } from "electron";
import type { SecretCrypto } from "./store.js";

export const createElectronSecretCrypto = (): SecretCrypto => ({
  isAvailable: () => safeStorage.isEncryptionAvailable(),
  encrypt: (input: string) =>
    safeStorage.encryptString(input).toString("base64"),
  decrypt: (input: string) =>
    safeStorage.decryptString(Buffer.from(input, "base64")),
});
