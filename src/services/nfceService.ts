export interface NfceItem {
  product_name: string;
  quantity: number;
  unit: string;
  total_price: number;
}

export const nfceService = {
  async processQRCodeUrl(url: string): Promise<NfceItem[]> {
    const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    // Validação básica para garantir que é um link de NFC-e
    if (!url.startsWith('http') || (!url.includes('sefaz') && !url.includes('fazenda'))) {
      throw new Error('QR Code inválido. Certifique-se de que está a ler o QR Code de uma NFC-e.');
    }

    try {
      console.log('A enviar URL da SEFAZ para a API:', url);
      
      // ⚠️ SUBSTITUA PELO URL DA SUA SUPABASE EDGE FUNCTION OU API REAL
      const API_URL = process.env.EXPO_PUBLIC_NFCE_API_URL; 
      const API_TOKEN = process.env.EXPO_PUBLIC_NFCE_API_TOKEN; // Opcional: Se a sua API exigir autenticação

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}` 
        },
        body: JSON.stringify({ url })
      });

      if (!response.ok) {
        throw new Error(`Falha na comunicação com o servidor de extração (Erro ${response.status}).`);
      }

      const data = await response.json();
      
      // Valida se a resposta tem o formato esperado
      if (!data || !Array.isArray(data.items)) {
        throw new Error('A API devolveu um formato de dados inesperado.');
      }

      // Mapeia os dados recebidos para garantir que correspondem à interface NfceItem
      const items: NfceItem[] = data.items.map((item: any) => ({
        product_name: item.name || item.product_name || 'Produto sem nome',
        quantity: parseFloat(item.quantity || item.qtd || 1),
        unit: item.unit || item.unidade || 'un',
        total_price: parseFloat(item.total_price || item.preco_total || 0)
      }));

      return items;

    } catch (error: any) {
      console.error('Erro ao processar a NFC-e real:', error);
      throw new Error(error.message || 'Não foi possível extrair os dados desta nota fiscal.');
    }
  }
};