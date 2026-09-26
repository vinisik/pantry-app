import React, { useEffect } from 'react';
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

  const { data: items, isLoading, isError, refetch } = useQuery({
    queryKey: ['pantry', houseId],
    queryFn: () => pantryService.getEstimatedPantry(houseId),
  });

  const aiCheckMutation = useMutation({
    mutationFn: () => pantryService.checkAndAutoUpdateLowStock(houseId, userId),
    onSuccess: (updatedCount) => {
      if (updatedCount > 0) {
        refetch();
        queryClient.invalidateQueries({ queryKey: ['shoppingList', houseId] });
      }
    }
  });

  useEffect(() => {
    aiCheckMutation.mutate();
  }, []);

  const statusMutation = useMutation({
    mutationFn: (params: any) => pantryService.updateItemStatus(
      params.id, houseId, userId, params.status, params.name, params.unit
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pantry', houseId] });
      queryClient.invalidateQueries({ queryKey: ['shoppingList', houseId] }); 
    },
    onError: (error: any) => Alert.alert('Erro', error.message)
  });

  const handleStatusChange = (item: any, newStatus: string) => {
    statusMutation.mutate({ id: item.id, name: item.product_name, unit: item.unit, status: newStatus });
  };

  if (isLoading) return <View style={styles.centered}><Text style={styles.loadingText}>Calculando despensa...</Text></View>;
  if (isError) return <View style={styles.centered}><Text style={styles.errorText}>Erro ao carregar a despensa.</Text></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📦 Despensa em Casa</Text>
        <Text style={styles.subtitle}>Controle inteligente da sua despensa</Text>
      </View>
      
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🛒</Text>
            <Text style={styles.emptyText}>Sua despensa está vazia. Confirme compras na aba Faltando para alimentá-la.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, item.status === 'RUNNING_LOW' && styles.cardLow]}>
            <View style={styles.cardInfo}>
              <Text style={styles.product}>{item.product_name}</Text>
              <Text style={[styles.statusText, item.status === 'RUNNING_LOW' ? styles.textLow : styles.textOk]}>
                {item.status === 'AVAILABLE' ? '✨ Em boa quantidade' : '⚠️ A acabar'} ({item.unit})
              </Text>
              {item.expected_duration_days && (
                <Text style={styles.durationText}>Ritmo estimado: ~{item.expected_duration_days} dias</Text>
              )}
            </View>
            
            <View style={styles.actions}>
              {item.status === 'RUNNING_LOW' && (
                <TouchableOpacity style={[styles.btn, styles.btnOk]} onPress={() => handleStatusChange(item, 'AVAILABLE')}>
                  <Text style={styles.btnText}>Tenho</Text>
                </TouchableOpacity>
              )}
              {item.status === 'AVAILABLE' && (
                <TouchableOpacity style={[styles.btn, styles.btnLow]} onPress={() => handleStatusChange(item, 'RUNNING_LOW')}>
                  <Text style={styles.btnText}>Acabando</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.btn, styles.btnOut]} onPress={() => handleStatusChange(item, 'OUT_OF_STOCK')}>
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
  container: { flex: 1, backgroundColor: '#F8F9FA', paddingTop: 50 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' },
  loadingText: { color: '#6C757D', fontSize: 15, fontWeight: '500' },
  errorText: { color: '#D32F2F', fontSize: 15, fontWeight: '500' },
  header: { paddingHorizontal: 20, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#1C1C1E' },
  subtitle: { fontSize: 14, color: '#6C757D', marginTop: 2 },
  listContainer: { paddingHorizontal: 20, paddingBottom: 20 },
  emptyContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 20 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { textAlign: 'center', color: '#6C757D', fontSize: 15, lineHeight: 22 },
  card: { backgroundColor: '#FFFFFF', padding: 16, marginBottom: 12, borderRadius: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#2E7D32' },
  cardLow: { borderLeftColor: '#F57C00' },
  cardInfo: { flex: 1, marginRight: 12 },
  product: { fontSize: 17, fontWeight: '600', color: '#1C1C1E' },
  statusText: { fontSize: 13, marginTop: 4, fontWeight: '500' },
  textOk: { color: '#2E7D32' },
  textLow: { color: '#F57C00' },
  durationText: { color: '#8E8E93', fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 6 },
  btn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  btnOk: { backgroundColor: '#E8F5E9' },
  btnLow: { backgroundColor: '#FFF3E0' },
  btnOut: { backgroundColor: '#FFEBEE' },
  btnText: { color: '#1C1C1E', fontWeight: '600', fontSize: 12 }
});