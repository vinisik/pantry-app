import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { houseService } from '../services/houseService';

interface HouseProfileScreenProps {
  houseId: string;
}

export default function HouseProfileScreen({ houseId }: HouseProfileScreenProps) {
  const queryClient = useQueryClient();
  
  const [newValue, setNewValue] = useState('');

  const { data: preferences, isLoading, isError } = useQuery({
    queryKey: ['housePreferences', houseId],
    queryFn: () => houseService.getHousePreferences(houseId),
  });

  const addMutation = useMutation({
    mutationFn: (params: { type: 'RESTRICTION' | 'PREFERENCE', value: string }) => 
      houseService.addPreference(houseId, params.type, params.value),
    onSuccess: () => {
      setNewValue('');
      queryClient.invalidateQueries({ queryKey: ['housePreferences', houseId] });
    },
    onError: (error: any) => Alert.alert('Erro', error.message)
  });

  const removeMutation = useMutation({
    mutationFn: houseService.removePreference,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['housePreferences', houseId] });
    },
    onError: (error: any) => Alert.alert('Erro', error.message)
  });

  const handleAdd = (type: 'RESTRICTION' | 'PREFERENCE') => {
    if (!newValue.trim()) {
      return Alert.alert('Aviso', 'Digite um valor antes de adicionar.');
    }
    addMutation.mutate({ type, value: newValue.trim() });
  };

  if (isLoading) return <View style={styles.centered}><Text>Carregando perfil...</Text></View>;
  if (isError) return <View style={styles.centered}><Text>Erro ao carregar o perfil da residência.</Text></View>;

  // Separa os dados para exibir em blocos diferentes
  const restrictions = preferences?.filter(p => p.type === 'RESTRICTION') || [];
  const likes = preferences?.filter(p => p.type === 'PREFERENCE') || [];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Perfil da Residência</Text>
      <Text style={styles.subtitle}>
        Configure as regras alimentares para que o aplicativo possa sugerir receitas adequadas no futuro.
      </Text>

      <View style={styles.addForm}>
        <TextInput
          style={styles.input}
          placeholder="Ex: Sem glúten, Vegano, Massas..."
          value={newValue}
          onChangeText={setNewValue}
        />
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={[styles.btn, styles.btnRestriction]} 
            onPress={() => handleAdd('RESTRICTION')}
            disabled={addMutation.isPending}
          >
            <Text style={styles.btnText}>+ Restrição</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.btn, styles.btnPreference]} 
            onPress={() => handleAdd('PREFERENCE')}
            disabled={addMutation.isPending}
          >
            <Text style={styles.btnText}>+ Preferência</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⛔ Restrições Alimentares</Text>
        <Text style={styles.sectionDesc}>Filtros obrigatórios. O aplicativo nunca sugerirá receitas com estes itens.</Text>
        <View style={styles.chipContainer}>
          {restrictions.length === 0 && <Text style={styles.empty}>Nenhuma restrição cadastrada.</Text>}
          {restrictions.map(item => (
            <View key={item.id} style={[styles.chip, styles.chipRestriction]}>
              <Text style={styles.chipText}>{item.value}</Text>
              <TouchableOpacity onPress={() => removeMutation.mutate(item.id)} style={styles.chipDelete}>
                <Text style={styles.chipDeleteText}>X</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⭐ Preferências</Text>
        <Text style={styles.sectionDesc}>O aplicativo dará prioridade a receitas que combinem com estes gostos.</Text>
        <View style={styles.chipContainer}>
          {likes.length === 0 && <Text style={styles.empty}>Nenhuma preferência cadastrada.</Text>}
          {likes.map(item => (
            <View key={item.id} style={[styles.chip, styles.chipPreference]}>
              <Text style={styles.chipText}>{item.value}</Text>
              <TouchableOpacity onPress={() => removeMutation.mutate(item.id)} style={styles.chipDelete}>
                <Text style={styles.chipDeleteText}>X</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5', paddingTop: 30 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { color: '#666', marginBottom: 20, fontSize: 14, lineHeight: 20 },
  
  addForm: { backgroundColor: '#fff', padding: 16, borderRadius: 8, elevation: 1, marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 12, backgroundColor: '#fafafa', fontSize: 16 },
  actionRow: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  btnRestriction: { backgroundColor: '#F44336' },
  btnPreference: { backgroundColor: '#4CAF50' },
  btnText: { color: '#fff', fontWeight: 'bold' },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 4, color: '#333' },
  sectionDesc: { color: '#666', fontSize: 12, marginBottom: 12 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  empty: { color: '#999', fontStyle: 'italic' },
  
  chip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  chipRestriction: { backgroundColor: '#FFCDD2' },
  chipPreference: { backgroundColor: '#C8E6C9' },
  chipText: { color: '#333', fontWeight: '600', marginRight: 8 },
  chipDelete: { backgroundColor: 'rgba(0,0,0,0.1)', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  chipDeleteText: { fontSize: 12, fontWeight: 'bold', color: '#333' }
});