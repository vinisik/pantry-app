import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ListScreen from './ListScreen';
import PantryScreen from './PantryScreen';
import HouseProfileScreen from './HouseProfileScreen';
import RecipesScreen from './RecipeScreen';

interface MainScreenProps {
  session: any;
  houseId: string;
  onBack: () => void;
}

type TabType = 'LIST' | 'PANTRY' | 'RECIPES' | 'PROFILE';

export default function MainScreen({ session, houseId, onBack }: MainScreenProps) {
  const [activeTab, setActiveTab] = useState<TabType>('LIST');

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {activeTab === 'LIST' && <ListScreen session={session} houseId={houseId} onBack={onBack} />}
        {activeTab === 'PANTRY' && <PantryScreen session={session} houseId={houseId} />}
        {activeTab === 'RECIPES' && <RecipesScreen houseId={houseId} session={session}/>}
        {activeTab === 'PROFILE' && <HouseProfileScreen houseId={houseId} />}
      </View>
      
      {/* Barra de navegação inferior moderna */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'LIST' && styles.activeTab]} 
          onPress={() => setActiveTab('LIST')}
        >
          <Text style={styles.tabIcon}>🛒</Text>
          <Text style={[styles.tabText, activeTab === 'LIST' && styles.activeTabText]}>Faltando</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'PANTRY' && styles.activeTab]} 
          onPress={() => setActiveTab('PANTRY')}
        >
          <Text style={styles.tabIcon}>📦</Text>
          <Text style={[styles.tabText, activeTab === 'PANTRY' && styles.activeTabText]}>Despensa</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'RECIPES' && styles.activeTab]} 
          onPress={() => setActiveTab('RECIPES')}
        >
          <Text style={styles.tabIcon}>🍳</Text>
          <Text style={[styles.tabText, activeTab === 'RECIPES' && styles.activeTabText]}>Receitas</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'PROFILE' && styles.activeTab]} 
          onPress={() => setActiveTab('PROFILE')}
        >
          <Text style={styles.tabIcon}>🏠</Text>
          <Text style={[styles.tabText, activeTab === 'PROFILE' && styles.activeTabText]}>Residência</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { flex: 1 },
  tabBar: { 
    flexDirection: 'row', 
    backgroundColor: '#FFFFFF', 
    borderTopWidth: 1, 
    borderColor: '#EFEFEF', 
    paddingBottom: 24,
    paddingTop: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  activeTab: { transform: [{ translateY: -2 }] },
  tabIcon: { fontSize: 18, marginBottom: 2 },
  tabText: { fontSize: 11, color: '#8E8E93', fontWeight: '500' },
  activeTabText: { color: '#2E7D32', fontWeight: '700' }
});