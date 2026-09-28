import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
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

  const { data: houses, isLoading } = useQuery({ queryKey: ['houses', userId], queryFn: () => houseService.getUserHouses(userId) });

  const createMutation = useMutation({
    mutationFn: (params: { name: string, residents: number }) => houseService.createHouse(params.name, userId, params.residents),
    onSuccess: (newHouse) => {
      setHouseName(''); setResidentCount('1');
      queryClient.invalidateQueries({ queryKey: ['houses', userId] });
      onSelectHouse(newHouse.id);
    },
    onError: (error: any) => Alert.alert('Erro', error.message)
  });

  const updateMutation = useMutation({
    mutationFn: (params: { id: string, name: string, residents: number }) => houseService.updateHouse(params.id, params.name, params.residents),
    onSuccess: () => {
      setEditingHouseId(null); setHouseName(''); setResidentCount('1');
      queryClient.invalidateQueries({ queryKey: ['houses', userId] });
    },
    onError: (error: any) => Alert.alert('Erro', error.message)
  });

  const handleSave = () => {
    if (!houseName.trim()) return Alert.alert('Aviso', 'O nome da casa é obrigatório.');
    const count = parseInt(residentCount) || 1;
    if (editingHouseId) updateMutation.mutate({ id: editingHouseId, name: houseName.trim(), residents: count });
    else createMutation.mutate({ name: houseName.trim(), residents: count });
  };

  if (isLoading) return <View style={styles.centered}><Text style={styles.loadingText}>Carregando residências...</Text></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Residências</Text>
        <Text style={styles.subtitle}>Selecione um lar ou crie um novo</Text>
      </View>
      
      <FlatList
        data={houses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={<Text style={styles.empty}>Ainda não participa em nenhuma casa.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity style={styles.cardContent} onPress={() => onSelectHouse(item.id)}>
              <View style={styles.cardIcon}>
                <Feather name="home" size={24} color="#0F766E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.houseName}>{item.name}</Text>
                <Text style={styles.houseDetails}>{item.residentCount} morador(es)</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.editBtn} onPress={() => { setEditingHouseId(item.id); setHouseName(item.name); setResidentCount(item.residentCount.toString()); }}>
              <Feather name="settings" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>
        )}
      />

      <View style={styles.formContainer}>
        <Text style={styles.formTitle}>{editingHouseId ? 'Editar Residência' : 'Criar Nova Residência'}</Text>
        
        <View style={styles.inputWrapper}>
          <Feather name="edit-3" size={20} color="#94A3B8" style={styles.inputIcon} />
          <TextInput style={styles.input} placeholder="Nome da Residência (Ex: Apartamento)" placeholderTextColor="#94A3B8" value={houseName} onChangeText={setHouseName} />
        </View>
        
        <View style={styles.row}>
          <Text style={styles.label}>Nº de Moradores:</Text>
          <TextInput style={styles.inputSmall} keyboardType="numeric" value={residentCount} onChangeText={setResidentCount} />
        </View>

        <View style={styles.actionRow}>
          {editingHouseId && (
            <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => { setEditingHouseId(null); setHouseName(''); setResidentCount('1'); }}>
              <Text style={styles.btnTextCancel}>Cancelar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.btn, styles.btnSave, editingHouseId && { flex: 1 }]} onPress={handleSave}>
            <Text style={styles.btnTextSave}>{editingHouseId ? 'Salvar' : 'Criar Residência'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: Platform.OS === 'ios' ? 20 : 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { color: '#64748B', fontSize: 16, fontWeight: '500' },
  
  header: { paddingHorizontal: 24, marginBottom: 24 },
  title: { fontSize: 36, fontWeight: '900', color: '#0F172A', letterSpacing: -1.5, marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#64748B', fontWeight: '500' },
  
  listContainer: { paddingHorizontal: 20, paddingBottom: 20 },
  empty: { textAlign: 'center', color: '#94A3B8', fontSize: 16, marginTop: 40 },
  
  card: { backgroundColor: '#FFFFFF', padding: 20, marginBottom: 16, borderRadius: 24, shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3, flexDirection: 'row', alignItems: 'center' },
  cardContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  cardIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#CCFBF1', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  houseName: { fontSize: 18, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  houseDetails: { color: '#64748B', fontSize: 14, marginTop: 4, fontWeight: '500' },
  editBtn: { padding: 12, backgroundColor: '#F1F5F9', borderRadius: 16 },

  formContainer: { backgroundColor: '#FFFFFF', padding: 24, borderTopLeftRadius: 32, borderTopRightRadius: 32, shadowColor: '#94A3B8', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  formTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20, color: '#0F172A', letterSpacing: -0.5 },
  
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 16, marginBottom: 16 },
  inputIcon: { paddingLeft: 16 },
  input: { flex: 1, padding: 16, fontSize: 16, color: '#0F172A', fontWeight: '500' },
  
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingHorizontal: 4 },
  label: { fontSize: 16, color: '#334155', fontWeight: '700' },
  inputSmall: { backgroundColor: '#F1F5F9', padding: 12, borderRadius: 16, width: 80, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#0F172A' },
  
  actionRow: { flexDirection: 'row', gap: 12 },
  btn: { padding: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnSave: { backgroundColor: '#0F766E', flex: 1 },
  btnCancel: { backgroundColor: '#F1F5F9', flex: 1 },
  btnTextSave: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  btnTextCancel: { color: '#334155', fontWeight: '800', fontSize: 16 }
});