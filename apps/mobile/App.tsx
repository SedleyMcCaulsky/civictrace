import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { initLocalDatabase } from './src/db/sqlite';
import { AuthStorage, User } from './src/stores/auth.store';
import { SyncEngine } from './src/sync/sync.engine';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';

type Screen = 'Login' | 'Home';

export default function App() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<Screen>('Login');
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      await initLocalDatabase();
      const storedToken = await AuthStorage.getToken();
      const storedUser = await AuthStorage.getUser();
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(storedUser);
        setScreen('Home');
      }
      setReady(true);
      setInterval(() => SyncEngine.run(), 30_000);
    }
    init();
  }, []);

  async function handleLogin(newToken: string, newUser: User) {
    await AuthStorage.saveSession(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
    setScreen('Home');
  }

  async function handleLogout() {
    await AuthStorage.clearSession();
    setToken(null);
    setUser(null);
    setScreen('Login');
  }

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1e293b" />
        <Text style={styles.loadingText}>Starting CivicTrace...</Text>
      </View>
    );
  }

  if (screen === 'Login') {
    return <LoginScreen onLoginSuccess={handleLogin} />;
  }

  return <HomeScreen user={user} token={token} onLogout={handleLogout} />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', gap: 16 },
  loadingText: { fontSize: 14, color: '#64748b' },
});
