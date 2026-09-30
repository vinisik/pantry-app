import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from './src/lib/supabase';
import AuthScreen from './src/screens/AuthScreen';
import MainScreen from './src/screens/MainScreen';

const queryClient = new QueryClient();

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [houseId, setHouseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHouseId = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('house_id')
      .eq('id', userId)
      .single();

    if (data?.house_id) {
      setHouseId(data.house_id);
    } else {
      console.warn("Usuário sem residência atribuída na base de dados.");
    }
    setLoading(false);
  };

  useEffect(() => {
    // Verifica a sessão existente guardada no AsyncStorage
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchHouseId(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Escuta mudanças no estado de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(true); // Mostra o loading enquanto procura a casa
      if (session) {
        fetchHouseId(session.user.id);
      } else {
        setHouseId(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Exibe indicador de carregamento enquanto valida a sessão e a casa
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#0F766E" />
      </View>
    );
  }

  // Verifica se tem sessão e se a casa foi carregada com sucesso
  return (
    <QueryClientProvider client={queryClient}>
      {session && houseId ? (
        <MainScreen 
          session={session} 
          houseId={houseId} 
          onBack={() => {
            setSession(null);
            setHouseId(null);
            supabase.auth.signOut();
          }} 
        />
      ) : (
        <AuthScreen />
      )}
    </QueryClientProvider>
  );
}