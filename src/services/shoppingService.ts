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
      
    if (error) {
      throw new Error(`Erro ao buscar itens: ${error.message}`);
    }
    return data;
  },

  // Adiciona um novo item na lista de compras
  async addItem(houseId: string, userId: string, productName: string) {
    const { error } = await supabase.from('shopping_list_items').insert({
      house_id: houseId,
      product_name: productName,
      quantity_requested: 1, 
      unit: 'un', 
      status: 'PENDING',
      created_by: userId
    });

    if (error) throw new Error(`Erro ao adicionar item: ${error.message}`);
    
    // Registra a intenção de compra
    await supabase.from('house_events').insert({
      house_id: houseId,
      actor_id: userId,
      event_type: 'ITEM_ADDED',
      payload: { product_name: productName, unit: 'un' }
    });
  },
  // Confirma compra total ou parcial com idempotência e log para ML, além de alimentar a despensa
  async confirmPurchase(params: BuyItemParams) {
    // Verificar estado atual 
    const { data: currentItem, error: fetchError } = await supabase
      .from('shopping_list_items')
      .select('quantity_bought, status')
      .eq('id', params.itemId)
      .single();

    if (fetchError || !currentItem) {
      throw new Error('Item não encontrado ou erro de rede.');
    }
    
    if (currentItem.status === 'COMPLETED') {
      return { success: true, isCompleted: true }; // Já foi comprado por outro morador
    }

    const newTotalBought = currentItem.quantity_bought + params.quantityBoughtNow;
    const isCompleted = newTotalBought >= params.quantityRequested;

    // Atualizar o item na lista de compras
    const { error: updateError } = await supabase
      .from('shopping_list_items')
      .update({
        quantity_bought: newTotalBought,
        status: isCompleted ? 'COMPLETED' : 'PENDING',
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.itemId);

    if (updateError) {
      throw new Error('Falha ao registrar compra. Tente novamente.');
    }

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
        is_special_occasion: false // Preparo para a funcionalidade de ocasiões especiais
      }
    });

    // Alimentar a Despensa 
    const { error: pantryError } = await supabase
      .from('pantry_items')
      .upsert({
        house_id: params.houseId,
        product_name: params.productName,
        unit: params.unit,
        status: 'AVAILABLE',
        updated_at: new Date().toISOString()
      }, { onConflict: 'house_id, product_name, unit' });

    if (pantryError) {
      console.warn("Aviso: Falha ao sincronizar despensa", pantryError);
    }

    return { success: true, isCompleted };
  }
};