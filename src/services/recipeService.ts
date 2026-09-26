import { supabase } from '../lib/supabase';

export const recipeService = {
  async getCatalog() {
    const { data, error } = await supabase
      .from('recipes')
      .select(`
        *,
        recipe_ingredients (*)
      `)
      .order('title', { ascending: true });

    if (error) throw new Error(`Erro ao buscar receitas: ${error.message}`);
    return data;
  },

  // Registra que a casa preparou esta receita 
  async registerPrep(houseId: string, userId: string, recipeName: string) {
    const { error } = await supabase.from('house_events').insert({
      house_id: houseId,
      actor_id: userId,
      event_type: 'RECIPE_PREPARED',
      payload: { recipe_name: recipeName }
    });

    if (error) throw new Error(`Erro ao registrar preparo: ${error.message}`);
  }
};