import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface PantryScreenProps {
  houseId: string;
}

export default function PantryScreen({ houseId }: PantryScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Em Casa</Text>
      <Text style={styles.empty}>Sua despensa ainda não possui estimativas.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5', marginTop: 30 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  empty: { textAlign: 'center', color: '#666', marginTop: 40, fontSize: 16 }
});