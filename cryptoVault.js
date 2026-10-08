import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

const VAULT_KEY = "lifetrackerDataEncryptionKey";
const RECOVERY_KEY = "lifetrackerRecoveryKey";
const RECOVERY_WRAP_KEY = "lifetrackerRecoveryWrappedKey";

async function getLocal(key) {
  if (Platform.OS === "web") return localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function setLocal(key, value) {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function removeLocal(key) {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function formatRecoveryCode(base64) {
  return base64.match(/.{1,4}/g)?.join("-") || base64;
}

function normalizeRecoveryCode(value) {
  return String(value || "").replace(/[^A-Za-z0-9+/=]/g, "");
}

export async function hasLocalVault() {
  return Boolean(await getLocal(VAULT_KEY));
}

export async function createNewVault() {
  const dataKey = await Crypto.AESEncryptionKey.generate(Crypto.AESKeySize.AES256);
  const recoveryKey = await Crypto.AESEncryptionKey.generate(Crypto.AESKeySize.AES256);
  const dataKeyBase64 = await dataKey.encoded("base64");
  const recoveryKeyBase64 = await recoveryKey.encoded("base64");

  await setLocal(VAULT_KEY, dataKeyBase64);
  await setLocal(RECOVERY_KEY, recoveryKeyBase64);

  const wrapped = await Crypto.aesEncryptAsync(dataKeyBase64, recoveryKey, {
    tagLength: 16,
  });

  const recoveryWrappedKey = await wrapped.combined("base64");
  await setLocal(RECOVERY_WRAP_KEY, recoveryWrappedKey);

  return {
    recoveryCode: formatRecoveryCode(recoveryKeyBase64),
    recoveryWrappedKey,
  };
}

export async function getLocalDataKey() {
  const raw = await getLocal(VAULT_KEY);
  if (!raw) return null;
  return Crypto.AESEncryptionKey.import(raw, "base64");
}

export async function getLocalRecoveryCode() {
  const raw = await getLocal(RECOVERY_KEY);
  return raw ? formatRecoveryCode(raw) : null;
}

export async function encryptPayload(payload) {
  const key = await getLocalDataKey();
  if (!key) throw new Error("Your secure data key is not available on this device.");

  const plaintext = JSON.stringify(payload);
  const plaintextBase64 = bytesToBase64(new TextEncoder().encode(plaintext));
  const sealed = await Crypto.aesEncryptAsync(plaintextBase64, key, { tagLength: 16 });

  return {
    version: 2,
    algorithm: "AES-256-GCM",
    ciphertext: await sealed.combined("base64"),
  };
}

export async function decryptPayload(bundle) {
  if (!bundle || bundle.version !== 2 || !bundle.ciphertext) {
    throw new Error("This cloud backup uses an older format and cannot be opened by the private vault.");
  }

  const key = await getLocalDataKey();
  if (!key) throw new Error("Your secure data key is not available on this device.");

  const sealed = Crypto.AESSealedData.fromCombined(bundle.ciphertext);
  const decryptedBase64 = await Crypto.aesDecryptAsync(sealed, key, { output: "base64" });
  const plaintext = new TextDecoder().decode(base64ToBytes(decryptedBase64));
  return JSON.parse(plaintext);
}

export async function restoreVaultFromRecovery(recoveryCode, wrappedKey) {
  const normalized = normalizeRecoveryCode(recoveryCode);
  if (!normalized) throw new Error("Enter your recovery code.");

  const recoveryKey = await Crypto.AESEncryptionKey.import(normalized, "base64");
  const sealed = Crypto.AESSealedData.fromCombined(wrappedKey);
  const dataKeyBase64 = await Crypto.aesDecryptAsync(sealed, recoveryKey, { output: "base64" });
  const dataKey = await Crypto.AESEncryptionKey.import(dataKeyBase64, "base64");

  await setLocal(VAULT_KEY, dataKeyBase64);
  await setLocal(RECOVERY_KEY, normalized);
  await setLocal(RECOVERY_WRAP_KEY, wrappedKey);

  return dataKey;
}

export async function getRecoveryWrappedKey() {
  return getLocal(RECOVERY_WRAP_KEY);
}

export async function ensureVault() {
  const existingDataKey = await getLocal(VAULT_KEY);
  const existingWrap = await getLocal(RECOVERY_WRAP_KEY);
  if (existingDataKey && existingWrap) return { created: false, recoveryCode: null, recoveryWrappedKey: existingWrap };
  if (!existingDataKey) return { created: true, ...(await createNewVault()) };

  const dataKey = await Crypto.AESEncryptionKey.import(existingDataKey, "base64");
  const recoveryKey = await Crypto.AESEncryptionKey.generate(Crypto.AESKeySize.AES256);
  const recoveryKeyBase64 = await recoveryKey.encoded("base64");
  const wrapped = await Crypto.aesEncryptAsync(existingDataKey, recoveryKey, { tagLength: 16 });
  const recoveryWrappedKey = await wrapped.combined("base64");
  await setLocal(RECOVERY_KEY, recoveryKeyBase64);
  await setLocal(RECOVERY_WRAP_KEY, recoveryWrappedKey);
  return { created: false, recoveryCode: formatRecoveryCode(recoveryKeyBase64), recoveryWrappedKey };
}

export async function clearVault() {
  await removeLocal(VAULT_KEY);
  await removeLocal(RECOVERY_KEY);
  await removeLocal(RECOVERY_WRAP_KEY);
}

export { formatRecoveryCode };
