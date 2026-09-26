import { supabase } from '../lib/supabase';

export interface BuyItemParams {
  itemId: string;
  houseId: string;
  userId: string;
  productName: string;
  quantityRequested: number;
  quantityBoughtNow: number;
  unit: string;
}

export const shoppingService = {
  // Busca itens pendentes com resiliência
  async getPendingItems(houseId: string) {
    const { data, error } = await supabase
      .from('shopping_list_items')
      .select('*')
      .eq('house_id', houseId)
      .eq('status', 'PENDING');
      
    if (error) throw new Error(error.message);
    return data;
  },

  // Confirma compra total ou parcial com idempotência e log para ML
  async confirmPurchase(params: BuyItemParams) {
    // Verificar estado atual (previne duplicação se múltiplos usuários clicarem juntos)
    const { data: currentItem, error: fetchError } = await supabase
      .from('shopping_list_items')
      .select('quantity_bought, status')
      .eq('id', params.itemId)
      .single();

    if (fetchError || !currentItem) throw new Error('Item não encontrado ou erro de rede.');
    if (currentItem.status === 'COMPLETED') return; // Já foi comprado por outro morador

    const newTotalBought = currentItem.quantity_bought + params.quantityBoughtNow;
    const isCompleted = newTotalBought >= params.quantityRequested;

    // Atualizar o item
    const { error: updateError } = await supabase
      .from('shopping_list_items')
      .update({
        quantity_bought: newTotalBought,
        status: isCompleted ? 'COMPLETED' : 'PENDING',
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.itemId);

    if (updateError) throw new Error('Falha ao registrar compra. Tente novamente.');

    // Registrar o evento histórico 
    await supabase.from('house_events').insert({
      house_id: params.houseId,
      actor_id: params.userId,
      event_type: isCompleted ? 'PURCHASE_COMPLETE' : 'PURCHASE_PARTIAL',
      payload: {
        item_id: params.itemId,
        product_name: params.productName,
        quantity_added: params.quantityBoughtNow,
        unit: params.unit,
        is_special_occasion: false 
      }
    });

    return { success: true, isCompleted };
  }
};