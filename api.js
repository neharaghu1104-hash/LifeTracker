import { Platform, DeviceEventEmitter } from "react-native";
import * as SecureStore from "expo-secure-store";
import { clearVault } from "./cryptoVault";

// API base URL must be configured in the root .env file.
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!configuredApiUrl) {
  throw new Error("Missing EXPO_PUBLIC_API_URL in the project .env file.");
}

export const API_URL = configuredApiUrl;

const TOKEN_KEY = "lifetrackerAuthToken";
const USER_KEY = "lifetrackerAuthUser";

/* =========================================================
   PLATFORM-SAFE STORAGE
   ========================================================= */

async function getStorageItem(key) {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }

  return SecureStore.getItemAsync(key);
}

async function setStorageItem(key, value) {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }

  return SecureStore.setItemAsync(key, value);
}

async function deleteStorageItem(key) {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
    return;
  }

  return SecureStore.deleteItemAsync(key);
}

/* =========================================================
   API REQUEST
   ========================================================= */

async function request(path, options = {}) {
  const token = await getStorageItem(TOKEN_KEY);

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      "Cannot connect to LifeTracker server. Make sure the API is running and your device can reach it."
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

/* =========================================================
   AUTH
   ========================================================= */

export async function registerUser(payload) {
  const data = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  await setStorageItem(TOKEN_KEY, data.token);
  await setStorageItem(USER_KEY, JSON.stringify(data.user));

  return data;
}

export async function loginUser(payload) {
  const data = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  await setStorageItem(TOKEN_KEY, data.token);
  await setStorageItem(USER_KEY, JSON.stringify(data.user));

  return data;
}

export async function changePassword(currentPassword, newPassword) {
  return request("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({
      currentPassword,
      newPassword,
    }),
  });
}

export async function forgotPassword(email) {
  return request("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({
      email,
    }),
  });
}

export async function resetPassword(email, code, password) {
  return request("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({
      email,
      code,
      password,
    }),
  });
}

export async function getMe() {
  return request("/api/auth/me");
}

/* =========================================================
   CLOUD SYNC
   ========================================================= */

export async function cloudSync(payload) {
  return request("/api/sync", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function cloudPull() {
  return request("/api/sync", {
    method: "GET",
  });
}

export async function deleteCloudData() {
  return request("/api/sync", {
    method: "DELETE",
  });
}

/* =========================================================
   ACCOUNT
   ========================================================= */

export async function deleteAccount(password) {
  const data = await request("/api/auth/account", {
    method: "DELETE",
    body: JSON.stringify({
      password,
    }),
  });

  await deleteStorageItem(TOKEN_KEY);
  await deleteStorageItem(USER_KEY);
  await clearVault();

  DeviceEventEmitter.emit("lifetracker-logout");

  return data;
}

/* =========================================================
   LOGOUT
   ========================================================= */

export async function logout() {
  try {
    await request("/api/auth/logout", {
      method: "POST",
    });
  } catch {}

  await deleteStorageItem(TOKEN_KEY);
  await deleteStorageItem(USER_KEY);

  DeviceEventEmitter.emit("lifetracker-logout");
}

/* =========================================================
   SESSION
   ========================================================= */

export async function hasSession() {
  const token = await getStorageItem(TOKEN_KEY);

  return !!token;
}

export async function getStoredUser() {
  const raw = await getStorageItem(USER_KEY);

  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}