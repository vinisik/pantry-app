import { supabase } from '../lib/supabase';

export const houseService = {
  async createHouse(name: string, userId: string, residentCount: number = 1) {
    const { data: house, error: houseError } = await supabase
      .from('houses')
      .insert([{ name, resident_count: residentCount }])
      .select('id, name, resident_count')
      .single();

    if (houseError || !house) throw new Error(`Erro ao criar casa: ${houseError?.message}`);

    const { error: participantError } = await supabase
      .from('house_participants')
      .insert([{ house_id: house.id, user_id: userId, role: 'ADMIN' }]);

    if (participantError) throw new Error(`Erro ao vincular morador: ${participantError.message}`);

    return house;
  },

  async getUserHouses(userId: string) {
    const { data, error } = await supabase
      .from('house_participants')
      .select('house_id, houses(name, resident_count)')
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
    
    return data.map((d: any) => ({ 
      id: d.house_id, 
      name: d.houses?.name || 'Casa Desconhecida',
      residentCount: d.houses?.resident_count || 1
    }));
  },

  async updateHouse(houseId: string, name: string, residentCount: number) {
    const { error } = await supabase
      .from('houses')
      .update({ name, resident_count: residentCount })
      .eq('id', houseId);

    if (error) throw new Error(`Falha ao atualizar a casa: ${error.message}`);
  }
};