import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '@/context/AuthContext';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { View, ActivityIndicator } from 'react-native';
import { setUnauthorizedHandler } from '@/lib/api-client';

export function RootNavigator() {
  const { isAuthenticated, isLoading, logout } = useAuth();

  // Wire 401 responses to logout
  React.useEffect(() => {
    setUnauthorizedHandler(() => { logout(); });
  }, [logout]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}
