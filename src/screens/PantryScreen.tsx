// src/screens/PantryScreen.tsx
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pantryService } from '../services/pantryService';

interface PantryScreenProps {
  houseId: string;
  session: any; 
}

export default function PantryScreen({ houseId, session }: PantryScreenProps) {
  const queryClient = useQueryClient();
  const userId = session.user.id;

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ['pantry', houseId],
    queryFn: () => pantryService.getEstimatedPantry(houseId),
  });

  const statusMutation = useMutation({
    mutationFn: (params: any) => pantryService.updateItemStatus(
      params.id, houseId, userId, params.status, params.name, params.unit
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pantry', houseId] });
      queryClient.invalidateQueries({ queryKey: ['shoppingList', houseId] }); // Atualiza a lista caso algo tenha "acabado"
    },
    onError: (error: any) => Alert.alert('Erro', error.message)
  });

  const handleStatusChange = (item: any, newStatus: string) => {
    statusMutation.mutate({ id: item.id, name: item.product_name, unit: item.unit, status: newStatus });
  };

  if (isLoading) return <View style={styles.centered}><Text>Calculando despensa...</Text></View>;
  if (isError) return <View style={styles.centered}><Text>Erro ao carregar a despensa.</Text></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Em Casa (Estimativa)</Text>
      
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>Sua despensa está vazia. Confirme compras na aba Faltando para alimentá-la.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.card, item.status === 'RUNNING_LOW' && styles.cardLow]}>
            <View>
              <Text style={styles.product}>{item.product_name}</Text>
              <Text style={styles.statusText}>
                {item.status === 'AVAILABLE' ? 'Em boa quantidade' : 'Acabando'} ({item.unit})
              </Text>
            </View>
            
            <View style={styles.actions}>
              {item.status === 'RUNNING_LOW' && (
                <TouchableOpacity 
                  style={[styles.btn, styles.btnOk]} 
                  onPress={() => handleStatusChange(item, 'AVAILABLE')}
                >
                  <Text style={styles.btnText}>Tenho</Text>
                </TouchableOpacity>
              )}
              {item.status === 'AVAILABLE' && (
                <TouchableOpacity 
                  style={[styles.btn, styles.btnLow]} 
                  onPress={() => handleStatusChange(item, 'RUNNING_LOW')}
                >
                  <Text style={styles.btnText}>Acabando</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={[styles.btn, styles.btnOut]} 
                onPress={() => handleStatusChange(item, 'OUT_OF_STOCK')}
              >
                <Text style={styles.btnText}>Acabou</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5', marginTop: 30 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  empty: { textAlign: 'center', color: '#666', marginTop: 40, fontSize: 16, paddingHorizontal: 20 },
  card: { backgroundColor: '#fff', padding: 16, marginBottom: 12, borderRadius: 8, elevation: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLow: { borderLeftWidth: 4, borderLeftColor: '#FF9800' },
  product: { fontSize: 18, fontWeight: '600' },
  statusText: { color: '#666', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 4 },
  btnOk: { backgroundColor: '#4CAF50' },
  btnLow: { backgroundColor: '#FF9800' },
  btnOut: { backgroundColor: '#F44336' },
  btnText: { color: '#fff', fontWeight: 'bold' }
});