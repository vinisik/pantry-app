import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, StyleSheet, ScrollView, Clipboard } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { houseService } from '../services/houseService';

interface ResidenceProfileScreenProps {
  houseId: string;
}

export default function ResidenceProfileScreen({ houseId }: ResidenceProfileScreenProps) {
  const queryClient = useQueryClient();
  const [newValue, setNewValue] = useState('');
  const [type, setType] = useState<'RESTRICTION' | 'PREFERENCE'>('RESTRICTION');

  // Busca as preferências/restrições da casa
  const { data: preferences, isLoading, isError } = useQuery({
    queryKey: ['housePreferences', houseId],
    queryFn: () => houseService.getHousePreferences(houseId),
  });

  // Busca os participantes para sabermos quem é Admin
  const { data: participants } = useQuery({
    queryKey: ['houseParticipants', houseId],
    queryFn: () => houseService.getHouseParticipants(houseId),
  });

  const currentUserId = houseService; 
  
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

  if (isLoading) return <View style={styles.centered}><Text>Carregando perfil da residência...</Text></View>;
  if (isError) return <View style={styles.centered}><Text>Erro ao carregar dados.</Text></View>;

  const copyToClipboard = () => {
    Clipboard.setString(houseId);
    Alert.alert('Sucesso!', 'Código da residência copiado para a área de transferência.');
  };

  return (
    <ScrollView style={styles.container}>
      {/* Bloco de Convite */}
      <View style={styles.inviteCard}>
        <Text style={styles.label}>Convidar Moradores</Text>
        <Text style={styles.subtext}>Compartilhe este código com quem deseja adicionar à residência:</Text>
        <View style={styles.codeRow}>
          <Text style={styles.codeText} numberOfLines={1}>{houseId}</Text>
          <TouchableOpacity style={styles.copyButton} onPress={copyToClipboard}>
            <Text style={styles.copyButtonText}>Copiar</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.title}>Perfil da Residência</Text>
      <Text style={styles.subtitle}>Gerencie restrições e preferências da residência.</Text>

      {/* Formulário para Adicionar Regra */}
      <View style={styles.formCard}>
        <Text style={styles.label}>Adicionar Nova Regra</Text>
        
        <View style={styles.typeSelector}>
          <TouchableOpacity 
            style={[styles.typeButton, type === 'RESTRICTION' && styles.activeRestriction]} 
            onPress={() => setType('RESTRICTION')}
          >
            <Text style={[styles.typeText, type === 'RESTRICTION' && styles.activeTypeText]}>Restrição (Proibido)</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.typeButton, type === 'PREFERENCE' && styles.activePreference]} 
            onPress={() => setType('PREFERENCE')}
          >
            <Text style={[styles.typeText, type === 'PREFERENCE' && styles.activeTypeText]}>Preferência (Gosto)</Text>
          </TouchableOpacity>
        </View>

        <TextInput 
          style={styles.input} 
          placeholder="Ex: Sem Glúten, Vegano, Massa..." 
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
            <View>
              <Text style={styles.prefValue}>{pref.value}</Text>
              <Text style={[styles.prefType, pref.type === 'RESTRICTION' ? styles.textRestriction : styles.textPreference]}>
                {pref.type === 'RESTRICTION' ? '🚫 Restrição Obrigatória' : '⭐ Preferência da Casa'}
              </Text>
            </View>
            <TouchableOpacity style={styles.deleteButton} onPress={() => deleteMutation.mutate(pref.id)}>
              <Text style={styles.deleteButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* Lista de Membros da Casa */}
      <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Membros da Casa</Text>
      {participants?.map((member: any) => (
        <View key={member.user_id} style={styles.memberCard}>
          <Text style={styles.memberText}>Membro ID: {member.user_id.substring(0, 8)}...</Text>
          <Text style={[styles.memberRole, member.role === 'ADMIN' ? styles.roleAdmin : styles.roleMember]}>
            {member.role === 'ADMIN' ? '👑 Admin' : '🏠 Morador'}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5', paddingTop: 30 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { color: '#666', marginBottom: 20, marginTop: 4 },
  formCard: { backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 20, elevation: 1 },
  label: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  typeSelector: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeButton: { flex: 1, padding: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 6, alignItems: 'center', backgroundColor: '#fafafa' },
  activeRestriction: { backgroundColor: '#FFEBEE', borderColor: '#F44336' },
  activePreference: { backgroundColor: '#FFF9C4', borderColor: '#FBC02D' },
  typeText: { fontSize: 12, color: '#666', fontWeight: 'bold' },
  activeTypeText: { color: '#333' },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 6, backgroundColor: '#fafafa', marginBottom: 12, fontSize: 16 },
  addButton: { backgroundColor: '#2196F3', padding: 12, borderRadius: 6, alignItems: 'center' },
  addButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  empty: { color: '#666', fontStyle: 'italic', marginBottom: 20 },
  prefCard: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1 },
  prefValue: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  prefType: { fontSize: 12, marginTop: 2 },
  textRestriction: { color: '#D32F2F' },
  textPreference: { color: '#F57F17' },
  deleteButton: { backgroundColor: '#FFEBEE', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  deleteButtonText: { color: '#D32F2F', fontWeight: 'bold' },
  memberCard: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1 },
  memberText: { color: '#444', fontSize: 14 },
  memberRole: { fontWeight: 'bold', fontSize: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  roleAdmin: { backgroundColor: '#E3F2FD', color: '#1976D2' },
  roleMember: { backgroundColor: '#F5F5F5', color: '#666' },
  inviteCard: { backgroundColor: '#E3F2FD', padding: 16, borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: '#BBDEFB' },
  subtext: { color: '#555', fontSize: 13, marginBottom: 10 },
  codeRow: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#90CAF9', alignItems: 'center', paddingLeft: 10 },
  codeText: { flex: 1, color: '#1565C0', fontWeight: 'bold', fontSize: 13 },
  copyButton: { backgroundColor: '#1976D2', paddingVertical: 10, paddingHorizontal: 16, borderTopRightRadius: 5, borderBottomRightRadius: 5 },
  copyButtonText: { color: '#fff', fontWeight: 'bold' }
});