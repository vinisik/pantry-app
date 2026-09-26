import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ListScreen from './ListScreen';
import PantryScreen from './PantryScreen';

interface MainScreenProps {
  session: any;
  houseId: string;
  onBack: () => void;
}

export default function MainScreen({ session, houseId, onBack }: MainScreenProps) {
  const [activeTab, setActiveTab] = useState<'LIST' | 'PANTRY'>('LIST');

  return (
    <View style={styles.container}>
      {/* Área principal onde a tela ativa é renderizada */}
      <View style={styles.content}>
        {activeTab === 'LIST' ? (
          <ListScreen session={session} houseId={houseId} onBack={onBack} />
        ) : (
          <PantryScreen houseId={houseId} />
        )}
      </View>
      
      {/* Barra de navegação inferior */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'LIST' && styles.activeTab]} 
          onPress={() => setActiveTab('LIST')}
        >
          <Text style={[styles.tabText, activeTab === 'LIST' && styles.activeTabText]}>Faltando</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'PANTRY' && styles.activeTab]} 
          onPress={() => setActiveTab('PANTRY')}
        >
          <Text style={[styles.tabText, activeTab === 'PANTRY' && styles.activeTabText]}>Em Casa</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  tabBar: { 
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    borderTopWidth: 1, 
    borderColor: '#ddd', 
    paddingBottom: 20, // Espaço extra para o limite inferior da tela do celular
    paddingTop: 10 
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  activeTab: { borderTopWidth: 2, borderColor: '#4CAF50', marginTop: -11, paddingTop: 11 },
  tabText: { fontSize: 16, color: '#666' },
  activeTabText: { color: '#4CAF50', fontWeight: 'bold' }
});