import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'civictrace_token';
const USER_KEY = 'civictrace_user';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  permissions: string[];
  isFieldOfficer: boolean;
}

export const AuthStorage = {
  async saveSession(token: string, user: User) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  },

  async clearSession() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  },

  async getToken(): Promise<string | null> {
    try { return await SecureStore.getItemAsync(TOKEN_KEY); }
    catch { return null; }
  },

  async getUser(): Promise<User | null> {
    try {
      const str = await SecureStore.getItemAsync(USER_KEY);
      return str ? JSON.parse(str) : null;
    } catch { return null; }
  },
};

export async function getStoredToken(): Promise<string | null> {
  return AuthStorage.getToken();
}
