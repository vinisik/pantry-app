// src/screens/ListScreen.tsx
import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Alert, StyleSheet, ScrollView, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { shoppingService } from '../services/shoppingService';
import { pantryService } from '../services/pantryService'; 

interface ListScreenProps {
  session: any;
  houseId: string;
  onBack: () => void;
}

export default function ListScreen({ session, houseId, onBack }: ListScreenProps) {
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  const [partialAmounts, setPartialAmounts] = useState<Record<string, string>>({});
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editDuration, setEditDuration] = useState('');

  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemUnit, setNewItemUnit] = useState('un');
  const [newItemDuration, setNewItemDuration] = useState('');

  const { data: items, isLoading } = useQuery({ queryKey: ['shoppingList', houseId], queryFn: () => shoppingService.getPendingItems(houseId) });
  const { data: suggestions } = useQuery({ queryKey: ['suggestions', houseId], queryFn: () => shoppingService.getSuggestions(houseId) });

  const addMutation = useMutation({
    mutationFn: (params: { name: string, qty: number, unit: string, duration?: number }) => 
      shoppingService.addItem(houseId, userId, params.name, params.qty, params.unit, params.duration, false),
    onSuccess: () => {
      setNewItemName(''); setNewItemQty('1'); setNewItemUnit('un'); setNewItemDuration('');
      queryClient.invalidateQueries({ queryKey: ['shoppingList', houseId] });
      queryClient.invalidateQueries({ queryKey: ['suggestions', houseId] });
    },
    onError: (error: any) => Alert.alert('Erro', error.message)
  });

  const updateItemMutation = useMutation({
    mutationFn: (params: { itemId: string, qty: number, unit: string, duration?: number }) => 
      shoppingService.updateItem(params.itemId, params.qty, params.unit, params.duration),
    onSuccess: () => {
      setEditingItemId(null);
      queryClient.invalidateQueries({ queryKey: ['shoppingList', houseId] });
    },
    onError: (error: any) => Alert.alert('Erro', error.message)
  });

  const purchaseMutation = useMutation({
    mutationFn: shoppingService.confirmPurchase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList', houseId] });
      queryClient.invalidateQueries({ queryKey: ['pantry', houseId] });
      queryClient.invalidateQueries({ queryKey: ['suggestions', houseId] });
    },
    onError: (error: any) => Alert.alert('Erro', error.message || 'A compra falhou.'),
  });

  const deleteMutation = useMutation({
    mutationFn: shoppingService.deleteItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shoppingList', houseId] }),
  });

  const resolveSuggestionMutation = useMutation({
    mutationFn: (sug: any) => pantryService.updateItemStatus(sug.id, houseId, userId, 'AVAILABLE', sug.product_name, sug.unit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pantry', houseId] });
      queryClient.invalidateQueries({ queryKey: ['suggestions', houseId] });
    }
  });

  const removePantryItemMutation = useMutation({
    mutationFn: pantryService.deleteItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pantry', houseId] });
      queryClient.invalidateQueries({ queryKey: ['suggestions', houseId] });
    }
  });

  const handleSuggestionPress = (sug: any) => {
    Alert.alert(
      sug.product_name,
      'Este item está acabando. O que deseja fazer?',
      [
        { text: 'Adicionar à Lista', onPress: () => addMutation.mutate({ name: sug.product_name, qty: 1, unit: sug.unit, duration: sug.expected_duration_days }) },
        { text: 'Ainda tenho / Já comprei', onPress: () => resolveSuggestionMutation.mutate(sug) },
        { text: 'Não compro mais', onPress: () => removePantryItemMutation.mutate(sug.id), style: 'destructive' },
        { text: 'Ignorar', style: 'cancel' }
      ]
    );
  };

  const handleBuy = (item: any, isPartial: boolean) => {
    const inputAmount = partialAmounts[item.id];
    const qtyToBuy = isPartial && inputAmount ? parseFloat(inputAmount) : (item.quantity_requested - item.quantity_bought);
    if (isNaN(qtyToBuy) || qtyToBuy <= 0) return Alert.alert('Aviso', 'Quantidade inválida');
    purchaseMutation.mutate({ itemId: item.id, houseId, userId, productName: item.product_name, quantityRequested: item.quantity_requested, quantityBoughtNow: qtyToBuy, unit: item.unit });
  };

  const handleSaveEdit = (item: any) => {
    const newQ = parseFloat(editQty);
    if (isNaN(newQ) || newQ <= 0) return Alert.alert('Aviso', 'Insira uma quantidade válida.');
    const newDur = editDuration ? parseInt(editDuration) : undefined;
    updateItemMutation.mutate({ itemId: item.id, qty: newQ, unit: editUnit.trim() || item.unit, duration: newDur });
  };

  if (isLoading) return <View style={styles.centered}><Text style={styles.loadingText}>Carregando...</Text></View>;

  const activeSuggestions = suggestions?.filter(sug => !items?.some(item => item.product_name.toLowerCase() === sug.product_name.toLowerCase()));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Compras</Text>
        <Text style={styles.subtitle}>Gerencie os itens em falta</Text>
      </View>

      <View style={styles.addForm}>
        <View style={styles.inputWrapper}>
          <Feather name="shopping-bag" size={20} color="#94A3B8" style={styles.inputIcon} />
          <TextInput style={styles.inputName} placeholder="O que falta? (Ex: Azeite)" placeholderTextColor="#94A3B8" value={newItemName} onChangeText={setNewItemName} />
        </View>
        <View style={styles.row}>
          <TextInput style={styles.inputSmall} placeholder="Qtd" placeholderTextColor="#94A3B8" keyboardType="numeric" value={newItemQty} onChangeText={setNewItemQty} />
          <TextInput style={styles.inputSmall} placeholder="Unid" placeholderTextColor="#94A3B8" autoCapitalize="none" value={newItemUnit} onChangeText={setNewItemUnit} />
          <TextInput style={styles.inputMedium} placeholder="Dias dur." placeholderTextColor="#94A3B8" keyboardType="numeric" value={newItemDuration} onChangeText={setNewItemDuration} />
          <TouchableOpacity style={styles.addButton} onPress={() => newItemName.trim() && addMutation.mutate({ name: newItemName.trim(), qty: parseFloat(newItemQty) || 1, unit: newItemUnit.trim() || 'un', duration: parseInt(newItemDuration) || undefined })}>
            <Feather name="plus" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {activeSuggestions && activeSuggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Acabando em casa</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll}>
            {activeSuggestions.map((sug) => (
              <TouchableOpacity key={sug.id} style={styles.suggestionBadge} onPress={() => handleSuggestionPress(sug)}>
                <Feather name="alert-circle" size={14} color="#D97706" style={{ marginRight: 6 }}/>
                <Text style={styles.suggestionText}>{sug.product_name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="check-circle" size={64} color="#CBD5E1" style={{ marginBottom: 16 }} />
            <Text style={styles.empty}>Tudo comprado! A sua lista está vazia.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isEditing = editingItemId === item.id;
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.product}>{item.product_name}</Text>
                  {item.expected_duration_days && !isEditing && (
                    <Text style={styles.durationHint}>Duração: ~{item.expected_duration_days} dias</Text>
                  )}
                </View>

                {!isEditing ? (
                  <View style={styles.qtyRow}>
                    <View style={styles.qtyPill}>
                      <Text style={styles.qtyText}>{item.quantity_requested - item.quantity_bought} {item.unit}</Text>
                    </View>
                    <TouchableOpacity style={styles.editBtn} onPress={() => { setEditingItemId(item.id); setEditQty(String(item.quantity_requested - item.quantity_bought)); setEditUnit(item.unit); setEditDuration(item.expected_duration_days ? String(item.expected_duration_days) : ''); }}>
                      <Feather name="edit-2" size={16} color="#0F766E" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.editContainer}>
                    <View style={styles.editFieldGroup}>
                      <Text style={styles.editLabel}>Qtd</Text>
                      <TextInput style={styles.editInput} keyboardType="numeric" value={editQty} onChangeText={setEditQty} />
                    </View>

                    <View style={styles.editFieldGroup}>
                      <Text style={styles.editLabel}>Unidade</Text>
                      <TextInput style={styles.editInput} autoCapitalize="none" value={editUnit} onChangeText={setEditUnit} />
                    </View>

                    <View style={styles.editFieldGroup}>
                      <Text style={styles.editLabel}>Duração (dias)</Text>
                      <TextInput style={styles.editInput} keyboardType="numeric" value={editDuration} onChangeText={setEditDuration} />
                    </View>

                    <View style={styles.editActionsRow}>
                      <TouchableOpacity style={styles.saveEditBtn} onPress={() => handleSaveEdit(item)}>
                        <Feather name="check" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.cancelEditBtn} onPress={() => setEditingItemId(null)}>
                        <Feather name="x" size={16} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
              
              <View style={styles.actions}>
                <TextInput style={styles.inputPartial} placeholder="Qtd" placeholderTextColor="#94A3B8" keyboardType="numeric" onChangeText={(val) => setPartialAmounts(prev => ({ ...prev, [item.id]: val }))} />
                <TouchableOpacity style={styles.btnPartial} onPress={() => handleBuy(item, true)}>
                  <Feather name="pie-chart" size={20} color="#F59E0B" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnComplete} onPress={() => handleBuy(item, false)}>
                  <Feather name="check" size={20} color="#0F766E" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnDelete} onPress={() => deleteMutation.mutate(item.id)}>
                  <Feather name="trash-2" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: Platform.OS === 'ios' ? 20 : 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { color: '#64748B', fontSize: 16, fontWeight: '500' },
  
  header: { paddingHorizontal: 24, marginBottom: 20 },
  title: { fontSize: 36, fontWeight: '900', color: '#0F172A', letterSpacing: -1.5, marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#64748B', fontWeight: '500' },
  
  addForm: { backgroundColor: '#FFFFFF', marginHorizontal: 20, padding: 20, borderRadius: 24, marginBottom: 20, shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 16, marginBottom: 16 },
  inputIcon: { paddingLeft: 16 },
  inputName: { flex: 1, padding: 16, fontSize: 16, color: '#0F172A', fontWeight: '500' },
  row: { flexDirection: 'row', gap: 8 },
  inputSmall: { flex: 1, backgroundColor: '#F1F5F9', padding: 14, borderRadius: 16, textAlign: 'center', fontSize: 15, color: '#0F172A', fontWeight: '500' },
  inputMedium: { flex: 1.2, backgroundColor: '#F1F5F9', padding: 14, borderRadius: 16, textAlign: 'center', fontSize: 15, color: '#0F172A', fontWeight: '500' },
  addButton: { backgroundColor: '#0F766E', width: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 16 },
  
  suggestionsContainer: { paddingHorizontal: 20, marginBottom: 20 },
  suggestionsTitle: { fontSize: 14, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginLeft: 4 },
  suggestionsScroll: { flexDirection: 'row' },
  suggestionBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 10 },
  suggestionText: { color: '#B45309', fontWeight: '700', fontSize: 14 },
  
  listContainer: { paddingHorizontal: 20, paddingBottom: 40 },
  emptyState: { alignItems: 'center', marginTop: 60 },
  empty: { textAlign: 'center', color: '#94A3B8', fontSize: 16, fontWeight: '500' },
  
  card: { backgroundColor: '#FFFFFF', padding: 20, marginBottom: 16, borderRadius: 24, shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  product: { fontSize: 18, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  durationHint: { fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 2 },
  
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyPill: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  qtyText: { color: '#0F766E', fontWeight: '800', fontSize: 14 },
  editBtn: { padding: 6, backgroundColor: '#CCFBF1', borderRadius: 10 },

  editContainer: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  editFieldGroup: { alignItems: 'center' },
  editLabel: { fontSize: 10, fontWeight: '700', color: '#64748B', marginBottom: 2, textTransform: 'uppercase' },
  editInput: { backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 6, borderRadius: 8, width: 44, textAlign: 'center', fontWeight: '700', fontSize: 13, color: '#0F172A' },
  editActionsRow: { flexDirection: 'row', gap: 4, alignItems: 'center', marginBottom: 2 },
  saveEditBtn: { backgroundColor: '#0F766E', padding: 8, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  cancelEditBtn: { backgroundColor: '#F1F5F9', padding: 8, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  editRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editInputSmall: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, width: 42, textAlign: 'center', fontWeight: '700', fontSize: 13 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inputPartial: { backgroundColor: '#F1F5F9', padding: 12, flex: 1, borderRadius: 16, textAlign: 'center', fontSize: 15, fontWeight: '600' },
  btnPartial: { backgroundColor: '#FEF3C7', width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  btnComplete: { backgroundColor: '#CCFBF1', width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  btnDelete: { backgroundColor: '#FEE2E2', width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
});