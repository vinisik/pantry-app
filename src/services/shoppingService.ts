import { supabase } from '../lib/supabase';

export const shoppingService = {
  async getPendingItems(houseId: string) {
    const { data, error } = await supabase
      .from('shopping_list')
      .select('*')
      .eq('house_id', houseId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Erro ao buscar lista: ${error.message}`);
    return data;
  },

  async addItem(houseId: string, userId: string, productName: string, quantity: number, unit: string, duration?: number, isSpecialOccasion?: boolean) {
    const { error } = await supabase
      .from('shopping_list')
      .insert([{
        house_id: houseId,
        user_id: userId,
        product_name: productName.trim(),
        quantity_requested: quantity,
        quantity_bought: 0,
        unit: unit.trim() || 'un',
        expected_duration_days: duration || null,
        is_special_occasion: isSpecialOccasion || false
      }]);

    if (error) throw new Error(`Erro ao adicionar item à lista: ${error.message}`);
  },

  async confirmPurchase(params: { itemId: string, houseId: string, userId: string, productName: string, quantityRequested: number, quantityBoughtNow: number, unit: string }) {
    const { data: current } = await supabase
      .from('shopping_list')
      .select('quantity_bought, quantity_requested')
      .eq('id', params.itemId)
      .single();

    if (!current) return;

    const newBought = current.quantity_bought + params.quantityBoughtNow;

    if (newBought >= current.quantity_requested) {
      // Se comprou tudo, remove da lista de compras
      await supabase.from('shopping_list').delete().eq('id', params.itemId);
    } else {
      // Se comprou parcialmente, atualiza o progresso
      await supabase.from('shopping_list').update({ quantity_bought: newBought }).eq('id', params.itemId);
    }

    const { data: existingPantry } = await supabase
      .from('pantry_items')
      .select('id')
      .eq('house_id', params.houseId)
      .ilike('product_name', params.productName)
      .single();

    if (existingPantry) {
      await supabase
        .from('pantry_items')
        .update({ status: 'AVAILABLE', updated_at: new Date() })
        .eq('id', existingPantry.id);
    } else {
      await supabase
        .from('pantry_items')
        .insert([{
          house_id: params.houseId,
          user_id: params.userId,
          product_name: params.productName,
          unit: params.unit,
          status: 'AVAILABLE'
        }]);
    }
  },

  async deleteItem(itemId: string) {
    const { error } = await supabase.from('shopping_list').delete().eq('id', itemId);
    if (error) throw new Error(`Erro ao apagar item: ${error.message}`);
  },

  async getSuggestions(houseId: string) {
    const { data, error } = await supabase
      .from('pantry_items')
      .select('*')
      .eq('house_id', houseId)
      .in('status', ['RUNNING_LOW', 'OUT_OF_STOCK']);

    if (error) return [];
    return data;
  }
};