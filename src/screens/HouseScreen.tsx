import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { houseService } from '../services/houseService';

interface HouseScreenProps {
  session: any;
  onSelectHouse: (houseId: string) => void;
}

export default function HouseScreen({ session, onSelectHouse }: HouseScreenProps) {
  const queryClient = useQueryClient();
  const userId = session.user.id;

  const [houseName, setHouseName] = useState('');
  const [residentCount, setResidentCount] = useState('1');
  const [editingHouseId, setEditingHouseId] = useState<string | null>(null);

  const { data: houses, isLoading } = useQuery({
    queryKey: ['houses', userId],
    queryFn: () => houseService.getUserHouses(userId)
  });

  const createMutation = useMutation({
    mutationFn: (params: { name: string, residents: number }) => 
      houseService.createHouse(params.name, userId, params.residents),
    onSuccess: (newHouse) => {
      setHouseName('');
      setResidentCount('1');
      queryClient.invalidateQueries({ queryKey: ['houses', userId] });
      onSelectHouse(newHouse.id);
    },
    onError: (error: any) => Alert.alert('Erro', error.message)
  });

  const updateMutation = useMutation({
    mutationFn: (params: { id: string, name: string, residents: number }) => 
      houseService.updateHouse(params.id, params.name, params.residents),
    onSuccess: () => {
      setEditingHouseId(null);
      setHouseName('');
      setResidentCount('1');
      queryClient.invalidateQueries({ queryKey: ['houses', userId] });
    },
    onError: (error: any) => Alert.alert('Erro', error.message)
  });

  const handleSave = () => {
    if (!houseName.trim()) return Alert.alert('Aviso', 'O nome da casa é obrigatório.');
    const count = parseInt(residentCount) || 1;

    if (editingHouseId) {
      updateMutation.mutate({ id: editingHouseId, name: houseName.trim(), residents: count });
    } else {
      createMutation.mutate({ name: houseName.trim(), residents: count });
    }
  };

  const startEditing = (house: any) => {
    setEditingHouseId(house.id);
    setHouseName(house.name);
    setResidentCount(house.residentCount.toString());
  };

  const cancelEditing = () => {
    setEditingHouseId(null);
    setHouseName('');
    setResidentCount('1');
  };

  if (isLoading) return <View style={styles.centered}><Text>Carregando...</Text></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Suas Casas</Text>
      
      <FlatList
        data={houses}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>Você ainda não participa de nenhuma casa.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity style={styles.cardContent} onPress={() => onSelectHouse(item.id)}>
              <Text style={styles.houseName}>{item.name}</Text>
              <Text style={styles.houseDetails}>{item.residentCount} morador(es)</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.editBtn} onPress={() => startEditing(item)}>
              <Text style={styles.editBtnText}>Editar</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <View style={styles.formContainer}>
        <Text style={styles.formTitle}>{editingHouseId ? 'Editar Casa' : 'Criar Nova Casa'}</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Nome da Casa (ex: Sítio, Apartamento)"
          value={houseName}
          onChangeText={setHouseName}
        />
        
        <View style={styles.row}>
          <Text style={styles.label}>Nº de Moradores:</Text>
          <TextInput
            style={styles.inputSmall}
            keyboardType="numeric"
            value={residentCount}
            onChangeText={setResidentCount}
          />
        </View>

        <View style={styles.actionRow}>
          {editingHouseId && (
            <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={cancelEditing}>
              <Text style={styles.btnText}>Cancelar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[styles.btn, styles.btnSave, editingHouseId && { flex: 1 }]} 
            onPress={handleSave}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            <Text style={styles.btnText}>{editingHouseId ? 'Salvar Alterações' : 'Criar Casa'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5', marginTop: 30 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  empty: { color: '#666', textAlign: 'center', marginVertical: 20 },
  
  card: { backgroundColor: '#fff', padding: 16, marginBottom: 12, borderRadius: 8, elevation: 1, flexDirection: 'row', alignItems: 'center' },
  cardContent: { flex: 1 },
  houseName: { fontSize: 18, fontWeight: '600' },
  houseDetails: { color: '#666', marginTop: 4 },
  editBtn: { padding: 8, backgroundColor: '#e0e0e0', borderRadius: 4 },
  editBtnText: { color: '#333', fontWeight: 'bold' },

  formContainer: { backgroundColor: '#fff', padding: 16, borderRadius: 8, elevation: 2, marginTop: 20 },
  formTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 12, backgroundColor: '#fafafa' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  label: { fontSize: 16, marginRight: 8, color: '#333' },
  inputSmall: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 8, width: 60, backgroundColor: '#fafafa', textAlign: 'center' },
  actionRow: { flexDirection: 'row', gap: 12 },
  btn: { padding: 14, borderRadius: 8, alignItems: 'center' },
  btnSave: { backgroundColor: '#4CAF50', flex: 1 },
  btnCancel: { backgroundColor: '#F44336', flex: 1 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});