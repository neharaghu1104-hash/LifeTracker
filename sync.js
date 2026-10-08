import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { cloudPull, cloudSync } from "./api";
import { KEYS } from "./lifeData";
import { decryptPayload, encryptPayload, ensureVault, getRecoveryWrappedKey, hasLocalVault } from "./cryptoVault";

const CLOUD_KEYS = [KEYS.expenses, KEYS.notes, KEYS.events, KEYS.steps, KEYS.focus, KEYS.mood, KEYS.goals, KEYS.budgets, KEYS.username];
const LAST_SYNC_HASH = "lifetrackerLastSyncHash";

export async function getCloudPayload() {
  const values = await AsyncStorage.multiGet(CLOUD_KEYS);
  const out = {};
  for (const [key, value] of values) {
    if (value == null) continue;
    try { out[key] = JSON.parse(value); } catch { out[key] = value; }
  }
  return out;
}

async function stableHash(data) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(data));
}

function arrayMerge(local = [], remote = []) {
  const map = new Map();
  [...remote, ...local].forEach(item => {
    const id = item?.id;
    if (id == null) return;
    if (!map.has(id)) map.set(id, item);
    else {
      const old = map.get(id);
      const oldDate = new Date(old.updatedAt || old.date || old.completedAt || 0).getTime();
      const newDate = new Date(item.updatedAt || item.date || item.completedAt || 0).getTime();
      map.set(id, newDate >= oldDate ? item : old);
    }
  });
  return Array.from(map.values());
}

function mapMerge(local = {}, remote = {}) { return { ...remote, ...local }; }

export function mergeCloudData(local, remote, preferLocal = false) {
  if (!remote) return local;
  if (preferLocal) {
    return {
      ...local,
      expenses: Array.isArray(local.expenses) ? local.expenses : [],
      notes: Array.isArray(local.notes) ? local.notes : [],
      events: Array.isArray(local.events) ? local.events : [],
      goals: Array.isArray(local.goals) ? local.goals : [],
      steps: local.steps || {}, focus: local.focus || {}, mood: local.mood || {}, budgets: local.budgets || {},
      username: local.username || remote.username || "",
    };
  }
  return {
    ...local,
    expenses: arrayMerge(local.expenses, remote.expenses),
    notes: arrayMerge(local.notes, remote.notes),
    events: arrayMerge(local.events, remote.events),
    goals: arrayMerge(local.goals, remote.goals),
    steps: mapMerge(local.steps, remote.steps),
    focus: mapMerge(local.focus, remote.focus),
    mood: mapMerge(local.mood, remote.mood),
    budgets: mapMerge(local.budgets, remote.budgets),
    username: local.username || remote.username || "",
  };
}

async function saveMerged(merged) {
  const defaults = {
    [KEYS.expenses]: [], [KEYS.notes]: [], [KEYS.events]: [], [KEYS.steps]: {}, [KEYS.focus]: {},
    [KEYS.mood]: {}, [KEYS.goals]: [], [KEYS.budgets]: {}, [KEYS.username]: "",
  };
  await AsyncStorage.multiSet(CLOUD_KEYS.map(key => {
    const value = merged[key] ?? defaults[key] ?? {};
    // The name is saved as plain text, everything else as JSON
    return [key, key === KEYS.username ? String(value) : JSON.stringify(value)];
  }));
}

export async function backgroundSync() {
  const local = await getCloudPayload();
  const localHash = await stableHash(local);
  const lastHash = await AsyncStorage.getItem(LAST_SYNC_HASH);
  const remoteResult = await cloudPull();
  const remoteBundle = remoteResult.data;

  if (!(await hasLocalVault()) && remoteBundle) {
    throw new Error("RECOVERY_REQUIRED");
  }

  const localChanged = Boolean(lastHash) && localHash !== lastHash;

  if (remoteBundle) {
    let remoteData;
    try {
      remoteData = await decryptPayload(remoteBundle);
    } catch (error) {
      if (error?.message?.includes("older format")) throw error;
      throw new Error("RECOVERY_REQUIRED");
    }

    if (lastHash && localHash === lastHash) {
      await saveMerged(remoteData);
      await AsyncStorage.setItem(LAST_SYNC_HASH, await stableHash(remoteData));
      return remoteData;
    }

    const merged = mergeCloudData(local, remoteData, localChanged);
    await saveMerged(merged);
    const payload = await getCloudPayload();
    await uploadEncrypted(payload, remoteResult.recoveryWrappedKey);
    await AsyncStorage.setItem(LAST_SYNC_HASH, await stableHash(payload));
    return merged;
  }

  // First upload: the vault must already exist (App.js creates it and shows the recovery code)
  if (!(await hasLocalVault())) throw new Error("VAULT_SETUP_REQUIRED");
  const vault = await ensureVault();
  const payload = await getCloudPayload();
  await uploadEncrypted(payload, vault.recoveryWrappedKey);
  await AsyncStorage.setItem(LAST_SYNC_HASH, await stableHash(payload));
  return payload;
}

async function uploadEncrypted(payload, recoveryWrappedKey) {
  const wrapped = recoveryWrappedKey || await getRecoveryWrappedKey();
  if (!wrapped) throw new Error("Secure recovery key is not available.");
  const encrypted = await encryptPayload(payload);
  await cloudSync({ data: encrypted, recoveryWrappedKey: wrapped });
}

export async function createVaultAndSync() {
  const vault = await ensureVault();
  const payload = await getCloudPayload();
  await uploadEncrypted(payload, vault.recoveryWrappedKey);
  await AsyncStorage.setItem(LAST_SYNC_HASH, await stableHash(payload));
  return vault;
}

export async function restoreFromRemoteRecovery() {
  const result = await cloudPull();
  if (!result.data || result.data.version !== 2 || !result.recoveryWrappedKey) {
    throw new Error("No private cloud backup is available for this account.");
  }
  return result;
}