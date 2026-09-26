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

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'RECIPES' && styles.activeTab]} 
          onPress={() => setActiveTab('RECIPES')}
        >
          <Text style={[styles.tabText, activeTab === 'RECIPES' && styles.activeTabText]}>Receitas</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'PROFILE' && styles.activeTab]} 
          onPress={() => setActiveTab('PROFILE')}
        >
          <Text style={[styles.tabText, activeTab === 'PROFILE' && styles.activeTabText]}>Residência</Text>
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
    paddingBottom: 20,
    paddingTop: 10 
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  activeTab: { borderTopWidth: 2, borderColor: '#4CAF50', marginTop: -11, paddingTop: 11 },
  tabText: { fontSize: 13, color: '#666' },
  activeTabText: { color: '#4CAF50', fontWeight: 'bold' }
});