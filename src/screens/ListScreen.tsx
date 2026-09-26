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
  const [isSpecial, setIsSpecial] = useState(false);

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ['shoppingList', houseId],
    queryFn: () => shoppingService.getPendingItems(houseId),
  });

  const { data: suggestions } = useQuery({
    queryKey: ['suggestions', houseId],
    queryFn: () => shoppingService.getSuggestions(houseId),
  });

  // Mutação para adicionar item
  const addMutation = useMutation({
    mutationFn: (params: { name: string, qty: number, unit: string, duration?: number, isSpecialOccasion: boolean }) => 
      shoppingService.addItem(houseId, userId, params.name, params.qty, params.unit, params.duration, params.isSpecialOccasion),
    onSuccess: () => {
      setNewItemName(''); setNewItemQty('1'); setNewItemUnit('un'); setNewItemDuration(''); setIsSpecial(false);
      queryClient.invalidateQueries({ queryKey: ['shoppingList', houseId] });
      queryClient.invalidateQueries({ queryKey: ['suggestions', houseId] });
    },
    onError: (error: any) => Alert.alert('Erro', error.message)
  });

  // Compra com Offline-First
  const purchaseMutation = useMutation({
    mutationFn: shoppingService.confirmPurchase,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['shoppingList', houseId] });
      const previousList = queryClient.getQueryData(['shoppingList', houseId]);
      queryClient.setQueryData(['shoppingList', houseId], (old: any) => {
        if (!old) return old;
        return old.map((item: any) => {
          if (item.id === variables.itemId) {
            return { ...item, quantity_bought: item.quantity_bought + variables.quantityBoughtNow };
          }
          return item;
        }).filter((item: any) => item.quantity_requested > item.quantity_bought);
      });
      return { previousList };
    },
    onError: (error: any, variables, context) => {
      if (context?.previousList) queryClient.setQueryData(['shoppingList', houseId], context.previousList);
      Alert.alert('Erro', 'A compra falhou offline.');
    },
    onSettled: () => {
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

  // FUNÇÃO DE FEEDBACK DE SUGESTÃO
  const handleSuggestionPress = (sug: any) => {
    Alert.alert(
      sug.product_name,
      'Parece que este item está acabando. O que deseja fazer?',
      [
        { 
          text: 'Adicionar à Lista', 
          onPress: () => addMutation.mutate({ name: sug.product_name, qty: 1, unit: sug.unit, duration: sug.expected_duration_days, isSpecialOccasion: false }) 
        },
        { 
          text: 'Ainda tenho / Já comprei', 
          onPress: () => resolveSuggestionMutation.mutate(sug) 
        },
        { 
          text: 'Não compro mais', 
          onPress: () => removePantryItemMutation.mutate(sug.id),
          style: 'destructive'
        },
        { text: 'Ignorar por agora', style: 'cancel' }
      ]
    );
  };

  const handleBuy = (item: any, isPartial: boolean) => {
    const inputAmount = partialAmounts[item.id];
    const qtyToBuy = isPartial && inputAmount ? parseFloat(inputAmount) : (item.quantity_requested - item.quantity_bought);
    if (isNaN(qtyToBuy) || qtyToBuy <= 0) return Alert.alert('Aviso', 'Quantidade inválida');
    purchaseMutation.mutate({ itemId: item.id, houseId, userId, productName: item.product_name, quantityRequested: item.quantity_requested, quantityBoughtNow: qtyToBuy, unit: item.unit });
  };

  const handleAddItem = (nameOverride?: string) => {
    const name = nameOverride || newItemName.trim();
    if (!name) return;
    addMutation.mutate({ 
      name, 
      qty: parseFloat(newItemQty) || 1, 
      unit: newItemUnit.trim() || 'un', 
      duration: parseInt(newItemDuration) || undefined,
      isSpecialOccasion: isSpecial 
    });
  };

  if (isLoading) return <View style={styles.centered}><Text>A carregar lista...</Text></View>;
  if (isError) return <View style={styles.centered}><Text>Erro ao carregar a lista.</Text></View>;

  const activeSuggestions = suggestions?.filter(sug => !items?.some(item => item.product_name.toLowerCase() === sug.product_name.toLowerCase()));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}><Text style={styles.backText}>{"< Voltar"}</Text></TouchableOpacity>
        <Text style={styles.title}>Faltando em Casa</Text>
      </View>

      <View style={styles.addForm}>
        <TextInput style={styles.inputName} placeholder="O que falta? (ex: Arroz)" value={newItemName} onChangeText={setNewItemName} />
        <View style={styles.row}>
          <TextInput style={styles.inputSmall} placeholder="Qtd" keyboardType="numeric" value={newItemQty} onChangeText={setNewItemQty} />
          <TextInput style={styles.inputSmall} placeholder="Unid" value={newItemUnit} autoCapitalize="none" onChangeText={setNewItemUnit} />
          <TextInput style={styles.inputMedium} placeholder="Dura (dias)" keyboardType="numeric" value={newItemDuration} onChangeText={setNewItemDuration} />
          <TouchableOpacity style={styles.addButton} onPress={() => handleAddItem()} disabled={addMutation.isPending}><Text style={styles.addButtonText}>+</Text></TouchableOpacity>
        </View>
      </View>

      {/* Carrossel de Sugestões */}
      {activeSuggestions && activeSuggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Talvez precise:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll}>
            {activeSuggestions.map((sug) => (
              <TouchableOpacity 
                key={sug.id} 
                style={styles.suggestionBadge} 
                onPress={() => handleSuggestionPress(sug)}
              >
                <Text style={styles.suggestionText}>+ {sug.product_name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>Sua lista de compras está vazia.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardInfo}>
              <Text style={styles.product}>
                {item.product_name} {item.is_special_occasion && '🎉'}
              </Text>
              <Text style={styles.qty}>Falta: {item.quantity_requested - item.quantity_bought} {item.unit}</Text>
            </View>
            <View style={styles.actions}>
              <TextInput style={styles.inputPartial} placeholder="Qtd" keyboardType="numeric" onChangeText={(val) => setPartialAmounts(prev => ({ ...prev, [item.id]: val }))} />
              <TouchableOpacity style={styles.btnComplete} onPress={() => handleBuy(item, false)}><Text style={styles.btnText}>Comprei tudo</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnPartial} onPress={() => handleBuy(item, true)}><Text style={styles.btnText}>Parcial</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnDelete} onPress={() => deleteMutation.mutate(item.id)}><Text style={styles.btnText}>Remover</Text></TouchableOpacity>
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
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backButton: { marginRight: 16, padding: 8 },
  backText: { color: '#2196F3', fontWeight: 'bold', fontSize: 16 },
  title: { fontSize: 24, fontWeight: 'bold' },
  addForm: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 12, elevation: 1 },
  inputName: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 6, marginBottom: 8, backgroundColor: '#fafafa', fontSize: 16 },
  row: { flexDirection: 'row', gap: 8 },
  inputSmall: { flex: 1, borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 6, backgroundColor: '#fafafa' },
  inputMedium: { flex: 1.5, borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 6, backgroundColor: '#fafafa' },
  addButton: { backgroundColor: '#2196F3', width: 45, justifyContent: 'center', alignItems: 'center', borderRadius: 6 },
  addButtonText: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: -2 },
  suggestionsContainer: { marginBottom: 16 },
  suggestionsTitle: { fontSize: 14, fontWeight: 'bold', color: '#666', marginBottom: 8 },
  suggestionsScroll: { flexDirection: 'row' },
  suggestionBadge: { backgroundColor: '#E3F2FD', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#BBDEFB' },
  suggestionText: { color: '#1976D2', fontWeight: 'bold' },
  empty: { textAlign: 'center', color: '#666', marginTop: 40, fontSize: 16 },
  card: { backgroundColor: '#fff', padding: 12, marginBottom: 12, borderRadius: 8, elevation: 1 },
  cardInfo: { marginBottom: 8 },
  product: { fontSize: 18, fontWeight: '600' },
  qty: { color: '#666' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inputPartial: { borderWidth: 1, borderColor: '#ddd', padding: 8, width: 45, borderRadius: 4, backgroundColor: '#fafafa', textAlign: 'center' },
  btnPartial: { backgroundColor: '#FF9800', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 4 },
  btnComplete: { backgroundColor: '#4CAF50', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 4 },
  btnDelete: { backgroundColor: '#F44336', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 4 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  specialToggle: { marginTop: 10, padding: 8, borderRadius: 6, backgroundColor: '#f0f0f0', alignItems: 'center', borderWidth: 1, borderColor: '#ddd' },
  specialToggleActive: { backgroundColor: '#FFF9C4', borderColor: '#FBC02D' },
  specialToggleText: { color: '#666', fontSize: 12, fontWeight: 'bold' },
  specialToggleTextActive: { color: '#F57F17' },
});