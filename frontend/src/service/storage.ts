import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
// Drafts also contain financial data, so native drafts use SecureStore.
export async function readStorage(key: string) {
  return Platform.OS === "web"
    ? typeof localStorage === "undefined"
      ? null
      : localStorage.getItem(key)
    : SecureStore.getItemAsync(key);
}
export async function writeStorage(key: string, value: string | null) {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
  } else if (value === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value);
}
