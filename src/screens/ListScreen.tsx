import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Alert, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shoppingService } from '../services/shoppingService';

interface ListScreenProps {
  session: any;
  houseId: string;
  onBack: () => void;
}

export default function ListScreen({ session, houseId, onBack }: ListScreenProps) {
  const queryClient = useQueryClient();
  const userId = session.user.id;
  const [partialAmounts, setPartialAmounts] = useState<Record<string, string>>({});
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemUnit, setNewItemUnit] = useState('un');
  const [newItemDuration, setNewItemDuration] = useState('');

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ['shoppingList', houseId],
    queryFn: () => shoppingService.getPendingItems(houseId),
  });

  const purchaseMutation = useMutation({
    mutationFn: shoppingService.confirmPurchase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList', houseId] });
      queryClient.invalidateQueries({ queryKey: ['pantry', houseId] });
    },
    onError: (error: any) => Alert.alert('Erro', error.message)
  });

  const addMutation = useMutation({
    mutationFn: (params: { name: string, qty: number, unit: string, duration?: number }) => 
      shoppingService.addItem(houseId, userId, params.name, params.qty, params.unit, params.duration),
    onSuccess: () => {
      setNewItemName('');
      setNewItemQty('1');
      setNewItemUnit('un');
      setNewItemDuration('');
      queryClient.invalidateQueries({ queryKey: ['shoppingList', houseId] });
    },
    onError: (error: any) => Alert.alert('Erro', error.message)
  });

  const handleBuy = (item: any, isPartial: boolean) => {
    const inputAmount = partialAmounts[item.id];
    const qtyToBuy = isPartial && inputAmount ? parseFloat(inputAmount) : (item.quantity_requested - item.quantity_bought);

    if (isNaN(qtyToBuy) || qtyToBuy <= 0) return Alert.alert('Aviso', 'Quantidade inválida');

    purchaseMutation.mutate({
      itemId: item.id,
      houseId: houseId,
      userId: userId,
      productName: item.product_name,
      quantityRequested: item.quantity_requested,
      quantityBoughtNow: qtyToBuy,
      unit: item.unit
    });
  };

  const handleAddItem = () => {
    if (!newItemName.trim()) return;
    const qty = parseFloat(newItemQty) || 1;
    const duration = parseInt(newItemDuration);
    
    addMutation.mutate({
      name: newItemName.trim(),
      qty: qty,
      unit: newItemUnit.trim() || 'un',
      duration: isNaN(duration) ? undefined : duration
    });
  };

  if (isLoading) return <View style={styles.centered}><Text>Carregando lista...</Text></View>;
  if (isError) return <View style={styles.centered}><Text>Erro ao carregar a lista.</Text></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>{"< Voltar"}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Faltando em Casa</Text>
      </View>

      <View style={styles.addForm}>
        <TextInput
          style={styles.inputName}
          placeholder="O que está faltando? (ex: Arroz)"
          value={newItemName}
          onChangeText={setNewItemName}
        />
        <View style={styles.row}>
          <TextInput
            style={styles.inputSmall}
            placeholder="Qtd"
            keyboardType="numeric"
            value={newItemQty}
            onChangeText={setNewItemQty}
          />
          <TextInput
            style={styles.inputSmall}
            placeholder="Unid (kg, un, L)"
            value={newItemUnit}
            onChangeText={setNewItemUnit}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.inputMedium}
            placeholder="Dura aprox. (dias)"
            keyboardType="numeric"
            value={newItemDuration}
            onChangeText={setNewItemDuration}
          />
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={handleAddItem}
            disabled={addMutation.isPending}
          >
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>Sua lista de compras está vazia.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View>
              <Text style={styles.product}>{item.product_name}</Text>
              <Text style={styles.qty}>
                Falta: {item.quantity_requested - item.quantity_bought} {item.unit}
                {item.expected_duration_days ? ` • Dura ~${item.expected_duration_days} dias` : ''}
              </Text>
            </View>
            
            <View style={styles.actions}>
              <TextInput
                style={styles.inputPartial}
                placeholder="Qtd"
                keyboardType="numeric"
                onChangeText={(val) => setPartialAmounts(prev => ({ ...prev, [item.id]: val }))}
              />
              <TouchableOpacity style={styles.btnPartial} onPress={() => handleBuy(item, true)}>
                <Text style={styles.btnText}>Parcial</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnComplete} onPress={() => handleBuy(item, false)}>
                <Text style={styles.btnText}>Comprei Tudo</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backButton: { marginRight: 16, padding: 8 },
  backText: { color: '#2196F3', fontWeight: 'bold', fontSize: 16 },
  title: { fontSize: 24, fontWeight: 'bold' },
  
  // Estilos do formulário de inserção
  addForm: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 16, elevation: 1 },
  inputName: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 6, marginBottom: 8, backgroundColor: '#fafafa', fontSize: 16 },
  row: { flexDirection: 'row', gap: 8 },
  inputSmall: { flex: 1, borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 6, backgroundColor: '#fafafa' },
  inputMedium: { flex: 1.5, borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 6, backgroundColor: '#fafafa' },
  addButton: { backgroundColor: '#2196F3', width: 45, justifyContent: 'center', alignItems: 'center', borderRadius: 6 },
  addButtonText: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: -2 },
  
  empty: { textAlign: 'center', color: '#666', marginTop: 40, fontSize: 16 },
  card: { backgroundColor: '#fff', padding: 16, marginBottom: 12, borderRadius: 8, elevation: 1 },
  product: { fontSize: 18, fontWeight: '600' },
  qty: { color: '#666', marginBottom: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputPartial: { borderWidth: 1, borderColor: '#ddd', padding: 8, width: 60, borderRadius: 4, backgroundColor: '#fafafa' },
  btnPartial: { backgroundColor: '#FF9800', padding: 10, borderRadius: 4 },
  btnComplete: { backgroundColor: '#4CAF50', padding: 10, borderRadius: 4 },
  btnText: { color: '#fff', fontWeight: 'bold' }
});