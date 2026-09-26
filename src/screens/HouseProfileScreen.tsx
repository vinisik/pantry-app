import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView, Clipboard } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { houseService } from '../services/houseService';

interface ResidenceProfileScreenProps {
  houseId: string;
}

export default function ResidenceProfileScreen({ houseId }: ResidenceProfileScreenProps) {
  const queryClient = useQueryClient();
  const [newValue, setNewValue] = useState('');
  const [type, setType] = useState<'RESTRICTION' | 'PREFERENCE'>('RESTRICTION');

  const { data: preferences, isLoading, isError } = useQuery({
    queryKey: ['housePreferences', houseId],
    queryFn: () => houseService.getHousePreferences(houseId),
  });

  const { data: participants } = useQuery({
    queryKey: ['houseParticipants', houseId],
    queryFn: () => houseService.getHouseParticipants(houseId),
  });

  const addMutation = useMutation({
    mutationFn: () => houseService.addPreference(houseId, type, newValue.trim()),
    onSuccess: () => {
      setNewValue('');
      queryClient.invalidateQueries({ queryKey: ['housePreferences', houseId] });
    },
    onError: (error: any) => Alert.alert('Erro', error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (prefId: string) => houseService.removePreference(prefId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['housePreferences', houseId] }),
    onError: (error: any) => Alert.alert('Erro', error.message)
  });

  const handleAdd = () => {
    if (!newValue.trim()) return;
    addMutation.mutate();
  };

  if (isLoading) return <View style={styles.centered}><Text style={styles.loadingText}>Carregando perfil...</Text></View>;
  if (isError) return <View style={styles.centered}><Text style={styles.errorText}>Erro ao carregar dados.</Text></View>;

  const copyToClipboard = () => {
    Clipboard.setString(houseId);
    Alert.alert('Sucesso!', 'Código da residência copiado.');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Bloco de Convite */}
      <View style={styles.inviteCard}>
        <Text style={styles.label}>🏠 Convidar Moradores</Text>
        <Text style={styles.subtext}>Compartilhe este código com quem deseja adicionar à residência:</Text>
        <View style={styles.codeRow}>
          <Text style={styles.codeText} numberOfLines={1}>{houseId}</Text>
          <TouchableOpacity style={styles.copyButton} onPress={copyToClipboard}>
            <Text style={styles.copyButtonText}>Copiar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.title}>Perfil da Residência</Text>
      <Text style={styles.subtitle}>Gerencie regras e preferências alimentares da casa.</Text>

      {/* Formulário para Adicionar Regra */}
      <View style={styles.formCard}>
        <Text style={styles.label}>Adicionar Nova Regra</Text>
        
        <View style={styles.typeSelector}>
          <TouchableOpacity 
            style={[styles.typeButton, type === 'RESTRICTION' && styles.activeRestriction]} 
            onPress={() => setType('RESTRICTION')}
          >
            <Text style={[styles.typeText, type === 'RESTRICTION' && styles.activeRestrictionText]}>🚫 Restrição</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.typeButton, type === 'PREFERENCE' && styles.activePreference]} 
            onPress={() => setType('PREFERENCE')}
          >
            <Text style={[styles.typeText, type === 'PREFERENCE' && styles.activePreferenceText]}>⭐ Preferência</Text>
          </TouchableOpacity>
        </View>

        <TextInput 
          style={styles.input} 
          placeholder="Ex: Sem Glúten, Vegano, Alergia a amendoim..." 
          placeholderTextColor="#A0A0A0"
          value={newValue} 
          onChangeText={setNewValue} 
        />

        <TouchableOpacity style={styles.addButton} onPress={handleAdd} disabled={addMutation.isPending}>
          <Text style={styles.addButtonText}>Adicionar à Residência</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de Restrições e Preferências Atuais */}
      <Text style={styles.sectionTitle}>Regras Ativas</Text>
      {preferences && preferences.length === 0 ? (
        <Text style={styles.empty}>Nenhuma restrição ou preferência cadastrada.</Text>
      ) : (
        preferences?.map((pref: any) => (
          <View key={pref.id} style={styles.prefCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.prefValue}>{pref.value}</Text>
              <Text style={[styles.prefType, pref.type === 'RESTRICTION' ? styles.textRestriction : styles.textPreference]}>
                {pref.type === 'RESTRICTION' ? 'Restrição Obrigatória' : 'Preferência da Casa'}
              </Text>
            </View>
            <TouchableOpacity style={styles.deleteButton} onPress={() => deleteMutation.mutate(pref.id)}>
              <Text style={styles.deleteButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* Lista de Membros da Casa */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Membros da Residência</Text>
      {participants?.map((member: any) => (
        <View key={member.user_id} style={styles.memberCard}>
          <Text style={styles.memberText}>Membro: {member.user_id.substring(0, 8)}...</Text>
          <Text style={[styles.memberRole, member.role === 'ADMIN' ? styles.roleAdmin : styles.roleMember]}>
            {member.role === 'ADMIN' ? '👑 Admin' : '🏠 Morador'}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent: { padding: 20, paddingTop: 50, paddingBottom: 30 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' },
  loadingText: { color: '#6C757D', fontSize: 15, fontWeight: '500' },
  errorText: { color: '#D32F2F', fontSize: 15, fontWeight: '500' },
  title: { fontSize: 24, fontWeight: '700', color: '#1C1C1E' },
  subtitle: { color: '#6C757D', marginBottom: 20, marginTop: 2, fontSize: 14 },
  formCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 14, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#1C1C1E' },
  typeSelector: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeButton: { flex: 1, padding: 10, borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 10, alignItems: 'center', backgroundColor: '#FAFAFC' },
  activeRestriction: { backgroundColor: '#FFEBEE', borderColor: '#FFCDD2' },
  activePreference: { backgroundColor: '#FFF9C4', borderColor: '#FFF59D' },
  typeText: { fontSize: 13, color: '#6C757D', fontWeight: '600' },
  activeRestrictionText: { color: '#C62828' },
  activePreferenceText: { color: '#F57F17' },
  input: { borderWidth: 1, borderColor: '#E5E5EA', padding: 12, borderRadius: 10, backgroundColor: '#FAFAFC', marginBottom: 12, fontSize: 15, color: '#1C1C1E' },
  addButton: { backgroundColor: '#2E7D32', padding: 14, borderRadius: 10, alignItems: 'center' },
  addButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: '#1C1C1E' },
  empty: { color: '#8E8E93', fontStyle: 'italic', marginBottom: 20, fontSize: 14 },
  prefCard: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  prefValue: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  prefType: { fontSize: 12, marginTop: 3, fontWeight: '500' },
  textRestriction: { color: '#C62828' },
  textPreference: { color: '#F57F17' },
  deleteButton: { backgroundColor: '#FFEBEE', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  deleteButtonText: { color: '#C62828', fontWeight: 'bold' },
  memberCard: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  memberText: { color: '#495057', fontSize: 14 },
  memberRole: { fontWeight: '600', fontSize: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  roleAdmin: { backgroundColor: '#E3F2FD', color: '#1976D2' },
  roleMember: { backgroundColor: '#F1F3F5', color: '#495057' },
  inviteCard: { backgroundColor: '#E8F5E9', padding: 16, borderRadius: 14, marginBottom: 20, borderWidth: 1, borderColor: '#C8E6C9' },
  subtext: { color: '#495057', fontSize: 13, marginBottom: 10, lineHeight: 18 },
  codeRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#A5D6A7', alignItems: 'center', paddingLeft: 12 },
  codeText: { flex: 1, color: '#2E7D32', fontWeight: '700', fontSize: 14 },
  copyButton: { backgroundColor: '#2E7D32', paddingVertical: 12, paddingHorizontal: 18, borderTopRightRadius: 9, borderBottomRightRadius: 9 },
  copyButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 }
});