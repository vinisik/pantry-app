import { supabase } from '../lib/supabase';

export const houseService = {
  // Cria uma nova residência e adiciona o criador como membro principal 
  async createHouse(name: string, userId: string) {
    const { data: house, error: houseError } = await supabase
      .from('houses')
      .insert([{ name }])
      .select('id')
      .single();

    if (houseError) {
      console.error("ERRO AO INSERIR RESIDENCIA:", houseError);
      throw new Error(`Erro banco (Residência): ${houseError.message}`);
    }

    const { error: participantError } = await supabase
      .from('house_participants')
      .insert([{ house_id: house.id, user_id: userId, role: 'ADMIN' }]);

    if (participantError) {
      console.error("ERRO AO INSERIR PARTICIPANTE:", participantError);
      throw new Error(`Erro banco (Participante): ${participantError.message}`);
    }

    return house;
  },

  // Busca todas as Residências às quais o usuário logado pertence
  async getUserHouses(userId: string) {
    const { data, error } = await supabase
      .from('house_participants')
      .select('house_id, houses(name)')
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }
    
    return data.map((d: any) => ({ 
      id: d.house_id, 
      name: d.houses?.name || 'Residência Desconhecida' 
    }));
  }
};