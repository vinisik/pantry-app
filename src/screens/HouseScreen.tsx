// src/screens/HouseScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { houseService } from '../services/houseService';

export default function HouseScreen({ session, onSelectHouse }: { session: any, onSelectHouse: (houseId: string) => void }) {
  const [houses, setHouses] = useState<any[]>([]);
  const [newHouseName, setNewHouseName] = useState('');
  const [loading, setLoading] = useState(true);

  const userId = session.user.id;

  useEffect(() => {
    loadHouses();
  }, []);

  async function loadHouses() {
    setLoading(true);
    try {
      const userHouses = await houseService.getUserHouses(userId);
      setHouses(userHouses);
    } catch (error: any) {
      Alert.alert('Erro', error.message);
    }
    setLoading(false);
  }

  async function handleCreateHouse() {
    if (!newHouseName.trim()) return;
    try {
      const house = await houseService.createHouse(newHouseName, userId);
      setNewHouseName('');
      loadHouses(); // Recarrega a lista
    } catch (error: any) {
      Alert.alert('Erro ao criar residência', error.message);
    }
  }

  if (loading) return <View style={styles.container}><Text>Carregando residências...</Text></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>As Minhas Residências</Text>
      
      <FlatList
        data={houses}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => onSelectHouse(item.id)}>
            <Text style={styles.cardText}>🏠 {item.name}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Ainda não pertence a nenhuma residência.</Text>}
      />

      <View style={styles.createSection}>
        <Text style={styles.subtitle}>Criar Nova Residência</Text>
        <TextInput
          style={styles.input}
          placeholder="Nome da Residência (ex: Apartamento)"
          value={newHouseName}
          onChangeText={setNewHouseName}
        />
        <TouchableOpacity style={styles.button} onPress={handleCreateHouse}>
          <Text style={styles.buttonText}>Criar Residência</Text>
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity style={styles.logoutBtn} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.logoutText}>Terminar Sessão</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5', marginTop: 40 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  subtitle: { fontSize: 18, fontWeight: '600', marginBottom: 10 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 8, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  cardText: { fontSize: 18 },
  empty: { color: '#666', marginBottom: 20, fontStyle: 'italic' },
  createSection: { marginTop: 30, borderTopWidth: 1, borderColor: '#ddd', paddingTop: 20 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 6, marginBottom: 10, backgroundColor: '#fff' },
  button: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 6, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  logoutBtn: { marginTop: 40, padding: 15, alignItems: 'center' },
  logoutText: { color: '#d32f2f', fontWeight: 'bold' }
});