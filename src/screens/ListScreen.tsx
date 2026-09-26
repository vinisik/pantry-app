import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Alert, StyleSheet, ScrollView } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemUnit, setNewItemUnit] = useState('un');
  const [newItemDuration, setNewItemDuration] = useState('');

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ['shoppingList', houseId],
    queryFn: () => shoppingService.getPendingItems(houseId),
  });

  const { data: suggestions } = useQuery({
    queryKey: ['suggestions', houseId],
    queryFn: () => shoppingService.getSuggestions(houseId),
  });

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

  const purchaseMutation = useMutation({
    mutationFn: shoppingService.confirmPurchase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList', houseId] });
      queryClient.invalidateQueries({ queryKey: ['pantry', houseId] });
      queryClient.invalidateQueries({ queryKey: ['suggestions', houseId] });
    },
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
      'Parece que este item está acabando. O que deseja fazer?',
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

  const handleAddItem = () => {
    const name = newItemName.trim();
    if (!name) return;
    addMutation.mutate({ name, qty: parseFloat(newItemQty) || 1, unit: newItemUnit.trim() || 'un', duration: parseInt(newItemDuration) || undefined });
  };

  if (isLoading) return <View style={styles.centered}><Text style={styles.loadingText}>Carregando lista...</Text></View>;
  if (isError) return <View style={styles.centered}><Text style={styles.errorText}>Erro ao carregar a lista.</Text></View>;

  const activeSuggestions = suggestions?.filter(sug => !items?.some(item => item.product_name.toLowerCase() === sug.product_name.toLowerCase()));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🛒 Lista de Compras</Text>
          <Text style={styles.subtitle}>O que está faltando em casa</Text>
        </View>
      </View>

      {/* Formulário moderno de Adição */}
      <View style={styles.addForm}>
        <TextInput style={styles.inputName} placeholder="O que falta comprar? (ex: Arroz)" placeholderTextColor="#A0A0A0" value={newItemName} onChangeText={setNewItemName} />
        <View style={styles.row}>
          <TextInput style={styles.inputSmall} placeholder="Qtd" placeholderTextColor="#A0A0A0" keyboardType="numeric" value={newItemQty} onChangeText={setNewItemQty} />
          <TextInput style={styles.inputSmall} placeholder="Unid" placeholderTextColor="#A0A0A0" autoCapitalize="none" value={newItemUnit} onChangeText={setNewItemUnit} />
          <TextInput style={styles.inputMedium} placeholder="Dias dur." placeholderTextColor="#A0A0A0" keyboardType="numeric" value={newItemDuration} onChangeText={setNewItemDuration} />
          <TouchableOpacity style={styles.addButton} onPress={handleAddItem} disabled={addMutation.isPending}><Text style={styles.addButtonText}>＋</Text></TouchableOpacity>
        </View>
      </View>

      {/* Carrossel de Sugestões Inteligentes */}
      {activeSuggestions && activeSuggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>💡 Sugestões baseadas no consumo:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll}>
            {activeSuggestions.map((sug) => (
              <TouchableOpacity key={sug.id} style={styles.suggestionBadge} onPress={() => handleSuggestionPress(sug)}>
                <Text style={styles.suggestionText}>+ {sug.product_name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={<Text style={styles.empty}>Sua lista de compras está limpa e vazia!</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardInfo}>
              <Text style={styles.product}>{item.product_name}</Text>
              <Text style={styles.qty}>Falta comprar: <Text style={styles.qtyHighlight}>{item.quantity_requested - item.quantity_bought} {item.unit}</Text></Text>
            </View>
            <View style={styles.actions}>
              <TextInput style={styles.inputPartial} placeholder="Qtd" placeholderTextColor="#A0A0A0" keyboardType="numeric" onChangeText={(val) => setPartialAmounts(prev => ({ ...prev, [item.id]: val }))} />
              <TouchableOpacity style={styles.btnComplete} onPress={() => handleBuy(item, false)}><Text style={styles.btnText}>Tudo</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnPartial} onPress={() => handleBuy(item, true)}><Text style={styles.btnText}>Parcial</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnDelete} onPress={() => deleteMutation.mutate(item.id)}><Text style={styles.btnDeleteText}>✕</Text></TouchableOpacity>
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
  header: { paddingHorizontal: 20, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#1C1C1E' },
  subtitle: { fontSize: 14, color: '#6C757D', marginTop: 2 },
  addForm: { backgroundColor: '#FFFFFF', marginHorizontal: 20, padding: 14, borderRadius: 14, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  inputName: { borderWidth: 1, borderColor: '#E5E5EA', padding: 10, borderRadius: 10, marginBottom: 8, backgroundColor: '#FAFAFC', fontSize: 15, color: '#1C1C1E' },
  row: { flexDirection: 'row', gap: 6 },
  inputSmall: { flex: 1, borderWidth: 1, borderColor: '#E5E5EA', padding: 8, borderRadius: 8, backgroundColor: '#FAFAFC', textAlign: 'center', fontSize: 14 },
  inputMedium: { flex: 1.5, borderWidth: 1, borderColor: '#E5E5EA', padding: 8, borderRadius: 8, backgroundColor: '#FAFAFC', textAlign: 'center', fontSize: 14 },
  addButton: { backgroundColor: '#2E7D32', width: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
  addButtonText: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' },
  suggestionsContainer: { paddingHorizontal: 20, marginBottom: 12 },
  suggestionsTitle: { fontSize: 13, fontWeight: '600', color: '#6C757D', marginBottom: 8 },
  suggestionsScroll: { flexDirection: 'row' },
  suggestionBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#C8E6C9' },
  suggestionText: { color: '#2E7D32', fontWeight: '600', fontSize: 13 },
  listContainer: { paddingHorizontal: 20, paddingBottom: 20 },
  empty: { textAlign: 'center', color: '#8E8E93', marginTop: 30, fontSize: 15, fontStyle: 'italic' },
  card: { backgroundColor: '#FFFFFF', padding: 14, marginBottom: 10, borderRadius: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardInfo: { marginBottom: 10 },
  product: { fontSize: 17, fontWeight: '600', color: '#1C1C1E' },
  qty: { color: '#6C757D', fontSize: 13, marginTop: 2 },
  qtyHighlight: { color: '#F57C00', fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inputPartial: { borderWidth: 1, borderColor: '#E5E5EA', padding: 6, width: 42, borderRadius: 8, backgroundColor: '#FAFAFC', textAlign: 'center', fontSize: 13 },
  btnPartial: { backgroundColor: '#FFF3E0', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 },
  btnComplete: { backgroundColor: '#E8F5E9', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 },
  btnDelete: { backgroundColor: '#FFEBEE', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 },
  btnText: { color: '#1C1C1E', fontWeight: '600', fontSize: 12 },
  btnDeleteText: { color: '#D32F2F', fontWeight: 'bold', fontSize: 12 }
});