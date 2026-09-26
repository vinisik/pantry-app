// App.tsx
import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from './src/lib/supabase';
import AuthScreen from './src/screens/AuthScreen';
import HouseScreen from './src/screens/HouseScreen';
import MainScreen from './src/screens/MainScreen'; 

const queryClient = new QueryClient();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [selectedHouseId, setSelectedHouseId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsReady(true);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) setSelectedHouseId(null);
    });
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Carregando...</Text>
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
        {session && session.user ? (
          selectedHouseId ? (
            <MainScreen 
              session={session} 
              houseId={selectedHouseId} 
              onBack={() => setSelectedHouseId(null)} 
            />
          ) : (
            <HouseScreen session={session} onSelectHouse={setSelectedHouseId} />
          )
        ) : (
          <AuthScreen />
        )}
      </SafeAreaView>
    </QueryClientProvider>
  );
}