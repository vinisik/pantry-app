import React, { useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, StyleSheet, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { pantryService } from '../services/pantryService';

interface PantryScreenProps {
  houseId: string;
  session: any; 
}

export default function PantryScreen({ houseId, session }: PantryScreenProps) {
  const queryClient = useQueryClient();
  const userId = session.user.id;

  const { data: items, isLoading, refetch } = useQuery({ queryKey: ['pantry', houseId], queryFn: () => pantryService.getEstimatedPantry(houseId) });

  const aiCheckMutation = useMutation({
    mutationFn: () => pantryService.checkAndAutoUpdateLowStock(houseId, userId),
    onSuccess: (updatedCount) => {
      if (updatedCount > 0) {
        refetch();
        queryClient.invalidateQueries({ queryKey: ['shoppingList', houseId] });
      }
    }
  });

  useEffect(() => { aiCheckMutation.mutate(); }, []);

  const statusMutation = useMutation({
    mutationFn: (params: any) => pantryService.updateItemStatus(params.id, houseId, userId, params.status, params.name, params.unit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pantry', houseId] });
      queryClient.invalidateQueries({ queryKey: ['shoppingList', houseId] }); 
    },
    onError: (error: any) => Alert.alert('Erro', error.message)
  });

  const handleStatusChange = (item: any, newStatus: string) => {
    statusMutation.mutate({ id: item.id, name: item.product_name, unit: item.unit, status: newStatus });
  };

  if (isLoading) return <View style={styles.centered}><Text style={styles.loadingText}>Processando Despensa...</Text></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Despensa</Text>
        <Text style={styles.subtitle}>O que tem atualmente em casa</Text>
      </View>
      
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="package" size={64} color="#CBD5E1" style={{ marginBottom: 16 }} />
            <Text style={styles.emptyText}>A sua despensa está vazia.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isLow = item.status === 'RUNNING_LOW';
          return (
            <View style={styles.card}>
              <View style={[styles.statusIndicator, isLow ? styles.indicatorLow : styles.indicatorOk]} />
              
              <View style={styles.cardContent}>
                <View style={styles.cardInfo}>
                  <Text style={styles.product}>{item.product_name}</Text>
                  <View style={styles.badgeRow}>
                    <View style={[styles.statusBadge, isLow ? styles.badgeLow : styles.badgeOk]}>
                      <Text style={[styles.statusText, isLow ? styles.textLow : styles.textOk]}>
                        {isLow ? 'Acabando em casa' : 'Boa quantidade'}
                      </Text>
                    </View>
                    <Text style={styles.unitText}>{item.unit}</Text>
                  </View>
                </View>
                
                <View style={styles.actions}>
                  {isLow && (
                    <TouchableOpacity style={[styles.btn, styles.btnOk]} onPress={() => handleStatusChange(item, 'AVAILABLE')}>
                      <Feather name="corner-up-left" size={18} color="#0F766E" />
                    </TouchableOpacity>
                  )}
                  {item.status === 'AVAILABLE' && (
                    <TouchableOpacity style={[styles.btn, styles.btnLow]} onPress={() => handleStatusChange(item, 'RUNNING_LOW')}>
                      <Feather name="trending-down" size={18} color="#D97706" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.btn, styles.btnOut]} onPress={() => handleStatusChange(item, 'OUT_OF_STOCK')}>
                    <Feather name="trash-2" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: Platform.OS === 'ios' ? 60 : 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { color: '#64748B', fontSize: 16, fontWeight: '500' },
  
  header: { paddingHorizontal: 24, marginBottom: 24 },
  title: { fontSize: 36, fontWeight: '900', color: '#0F172A', letterSpacing: -1.5, marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#64748B', fontWeight: '500' },
  
  listContainer: { paddingHorizontal: 20, paddingBottom: 40 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { textAlign: 'center', color: '#94A3B8', fontSize: 16, fontWeight: '500' },
  
  card: { backgroundColor: '#FFFFFF', marginBottom: 16, borderRadius: 24, shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3, flexDirection: 'row', overflow: 'hidden' },
  statusIndicator: { width: 6, height: '100%' },
  indicatorOk: { backgroundColor: '#10B981' },
  indicatorLow: { backgroundColor: '#F59E0B' },
  
  cardContent: { flex: 1, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardInfo: { flex: 1, marginRight: 16 },
  product: { fontSize: 18, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5, marginBottom: 8 },
  
  badgeRow: { flexDirection: 'row', alignItems: 'center' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginRight: 8 },
  badgeOk: { backgroundColor: '#D1FAE5' },
  badgeLow: { backgroundColor: '#FEF3C7' },
  statusText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  textOk: { color: '#047857' },
  textLow: { color: '#B45309' },
  unitText: { color: '#94A3B8', fontWeight: '700', fontSize: 14 },
  
  actions: { flexDirection: 'row', gap: 10 },
  btn: { width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  btnOk: { backgroundColor: '#CCFBF1' },
  btnLow: { backgroundColor: '#FEF3C7' },
  btnOut: { backgroundColor: '#FEE2E2' },
});