import { supabase } from '../lib/supabase';

export const houseService = {
  async createHouse(name: string, userId: string, residentCount: number = 1) {
    const { data: house, error: houseError } = await supabase
      .from('houses')
      .insert([{ name, resident_count: residentCount }])
      .select('id, name, resident_count')
      .single();

    if (houseError || !house) throw new Error(`Erro ao criar Residência: ${houseError?.message}`);

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
      name: d.houses?.name || 'Residência Desconhecida',
      residentCount: d.houses?.resident_count || 1
    }));
  },

  async updateHouse(houseId: string, name: string, residentCount: number) {
    const { error } = await supabase
      .from('houses')
      .update({ name, resident_count: residentCount })
      .eq('id', houseId);

    if (error) throw new Error(`Falha ao atualizar a casa: ${error.message}`);
  },

  // Obtem as preferências de cada residencia
  async getHousePreferences(houseId: string) {
    const { data, error } = await supabase
      .from('house_preferences')
      .select('*')
      .eq('house_id', houseId)
      .order('type', { ascending: true })
      .order('value', { ascending: true });

    if (error) throw new Error(`Erro ao buscar preferências: ${error.message}`);
    return data;
  },

  // Adiciona uma nova restrição ou preferência
  async addPreference(houseId: string, type: 'RESTRICTION' | 'PREFERENCE', value: string) {
    const { error } = await supabase
      .from('house_preferences')
      .insert([{ house_id: houseId, type, value: value.trim() }]);

    if (error) {
      if (error.code === '23505') throw new Error('Esta preferência/restrição já foi adicionada.');
      throw new Error(`Erro ao adicionar: ${error.message}`);
    }
  },

  // Remove uma restrição ou preferência
  async removePreference(preferenceId: string) {
    const { error } = await supabase
      .from('house_preferences')
      .delete()
      .eq('id', preferenceId);

    if (error) throw new Error(`Erro ao remover: ${error.message}`);
  },

  // Busca os participantes de uma casa específica
  async getHouseParticipants(houseId: string) {
    const { data, error } = await supabase
      .from('house_participants')
      .select('*')
      .eq('house_id', houseId);

    if (error) throw new Error(`Erro ao buscar participantes: ${error.message}`);
    return data;
  },

  // Altera o papel de um participante 
  async updateParticipantRole(houseId: string, userId: string, newRole: 'ADMIN' | 'MEMBER') {
    const { error } = await supabase
      .from('house_participants')
      .update({ role: newRole })
      .eq('house_id', houseId)
      .eq('user_id', userId);

    if (error) throw new Error(`Erro ao atualizar papel: ${error.message}`);
  },

  // Permite a um user juntar-se a uma Residência existente através do ID
  async joinHouse(houseId: string, userId: string) {
    // Verifica se a casa realmente existe
    const { data: house, error: houseError } = await supabase
      .from('houses')
      .select('id')
      .eq('id', houseId)
      .single();

    if (houseError || !house) throw new Error('Residência não encontrada. Verifique o código.');

    // Verifica se o user já faz parte desta casa
    const { data: existing } = await supabase
      .from('house_participants')
      .select('user_id')
      .eq('house_id', houseId)
      .eq('user_id', userId)
      .single();

    if (existing) throw new Error('Você já faz parte desta residência.');

    // Insere o novo membro como 'MEMBER'
    const { error: insertError } = await supabase
      .from('house_participants')
      .insert([{ house_id: houseId, user_id: userId, role: 'MEMBER' }]);

    if (insertError) throw new Error(`Erro ao entrar na residência: ${insertError.message}`);
  },

};