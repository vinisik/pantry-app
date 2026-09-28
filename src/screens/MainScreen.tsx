import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
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
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {activeTab === 'LIST' && <ListScreen session={session} houseId={houseId} onBack={onBack} />}
        {activeTab === 'PANTRY' && <PantryScreen session={session} houseId={houseId} />}
        {activeTab === 'RECIPES' && <RecipesScreen houseId={houseId} session={session}/>}
        {activeTab === 'PROFILE' && <HouseProfileScreen houseId={houseId} />}
      </View>
      
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('LIST')}>
          <View style={[styles.iconWrapper, activeTab === 'LIST' && styles.activeIconWrapper]}>
            <Feather name="shopping-cart" size={22} color={activeTab === 'LIST' ? '#0F766E' : '#64748B'} />
          </View>
          <Text style={[styles.tabText, activeTab === 'LIST' && styles.activeTabText]}>Compras</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('PANTRY')}>
          <View style={[styles.iconWrapper, activeTab === 'PANTRY' && styles.activeIconWrapper]}>
            <Feather name="package" size={22} color={activeTab === 'PANTRY' ? '#0F766E' : '#64748B'} />
          </View>
          <Text style={[styles.tabText, activeTab === 'PANTRY' && styles.activeTabText]}>Despensa</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('RECIPES')}>
          <View style={[styles.iconWrapper, activeTab === 'RECIPES' && styles.activeIconWrapper]}>
            <Feather name="book-open" size={22} color={activeTab === 'RECIPES' ? '#0F766E' : '#64748B'} />
          </View>
          <Text style={[styles.tabText, activeTab === 'RECIPES' && styles.activeTabText]}>Receitas</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('PROFILE')}>
          <View style={[styles.iconWrapper, activeTab === 'PROFILE' && styles.activeIconWrapper]}>
            <Feather name="home" size={22} color={activeTab === 'PROFILE' ? '#0F766E' : '#64748B'} />
          </View>
          <Text style={[styles.tabText, activeTab === 'PROFILE' && styles.activeTabText]}>Residência</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { flex: 1 },
  tabBar: { 
    flexDirection: 'row', 
    backgroundColor: '#FFFFFF', 
    borderTopWidth: 1, 
    borderColor: '#F1F5F9', 
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    paddingTop: 12,
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 10,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconWrapper: { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  activeIconWrapper: { backgroundColor: '#CCFBF1' },
  tabText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  activeTabText: { color: '#0F766E', fontWeight: '800' }
});