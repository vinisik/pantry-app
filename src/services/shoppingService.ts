import { supabase } from '../lib/supabase';
import { pantryService } from './pantryService';

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

  async updateItem(itemId: string, quantityRequested: number, unit: string, duration?: number) {
    const { error } = await supabase
      .from('shopping_list')
      .update({ 
        quantity_requested: quantityRequested, 
        unit: unit.trim() || 'un',
        expected_duration_days: duration || null
      })
      .eq('id', itemId);

    if (error) throw new Error(`Erro ao atualizar item: ${error.message}`);
  },

  async confirmPurchase(params: { itemId: string, houseId: string, userId: string, productName: string, quantityRequested: number, quantityBoughtNow: number, unit: string }) {
    // 1. Busca a VERDADE ABSOLUTA na base de dados (Ignora o houseId falho do frontend)
    const { data: current, error: fetchError } = await supabase
      .from('shopping_list')
      .select('house_id, quantity_bought, quantity_requested, product_name, unit')
      .eq('id', params.itemId)
      .single();

    if (fetchError || !current) throw new Error('Item não encontrado na base de dados.');

    // GARANTIA: O house_id que vem da própria tabela de compras (nunca será nulo)
    const safeHouseId = current.house_id;
    const safeProductName = current.product_name;
    const safeUnit = current.unit || 'un';

    const newBought = current.quantity_bought + params.quantityBoughtNow;

    if (newBought >= current.quantity_requested) {
      const { error: deleteError } = await supabase.from('shopping_list').delete().eq('id', params.itemId);
      if (deleteError) throw new Error(`Erro ao limpar lista de compras: ${deleteError.message}`);
    } else {
      const { error: updateError } = await supabase.from('shopping_list').update({ quantity_bought: newBought }).eq('id', params.itemId);
      if (updateError) throw new Error(`Erro ao atualizar lista de compras: ${updateError.message}`);
    }

    // 2. Procura na Despensa usando o ID seguro
    const { data: existingPantryItem } = await supabase
      .from('pantry_items')
      .select('id')
      .eq('house_id', safeHouseId)
      .ilike('product_name', safeProductName.trim())
      .maybeSingle();

    if (existingPantryItem) {
      const { error: pantryUpdateError } = await supabase
        .from('pantry_items')
        .update({ status: 'AVAILABLE' })
        .eq('id', existingPantryItem.id);
        
      if (pantryUpdateError) throw new Error(`Erro ao atualizar despensa: ${pantryUpdateError.message}`);
    } else {
      // 3. Insere na Despensa usando o ID seguro
      const { error: pantryInsertError } = await supabase
        .from('pantry_items')
        .insert({
          house_id: safeHouseId,
          product_name: safeProductName.trim(),
          unit: safeUnit.trim(),
          status: 'AVAILABLE'
        });

      if (pantryInsertError) throw new Error(`Erro ao enviar para despensa: ${pantryInsertError.message}`);
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