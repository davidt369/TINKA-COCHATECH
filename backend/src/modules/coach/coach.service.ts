import { Injectable, Logger } from '@nestjs/common';
import Groq from 'groq-sdk';

import { SalesService } from '../sales/sales.service';

@Injectable()
export class CoachService {
  private readonly logger = new Logger(CoachService.name);
  private readonly groq?: Groq;

  constructor(private readonly salesService: SalesService) {
    const apiKey = process.env.GROQ_API_KEY;

    if (apiKey) {
      this.groq = new Groq({ apiKey });
    }
  }

  async getChatResponse(
    userId: string,
    businessId: string,
    userMessage: string,
  ): Promise<string> {
    try {
      if (!this.groq) {
        return 'Configura GROQ_API_KEY en el archivo .env.';
      }

      const sales = await this.salesService.listSales(
        undefined,
        undefined,
        businessId,
      );

      const totalSales = sales.reduce((sum, sale) => sum + sale.amount, 0);

      const salesContext = {
        totalVentas: sales.length,
        totalIngresos: totalSales.toFixed(2),
        ultimasVentas: sales.slice(0, 5).map((sale) => ({
          producto: sale.product_name,
          monto: sale.amount,
          pago: sale.payment_method,
        })),
      };

      const systemPrompt = `
Eres Tinka, asesora financiera para emprendedores en Bolivia.

Reglas:
- Responde máximo 30 palabras.
- Sé clara, directa y breve.
- Usa español sencillo.
- Da consejos útiles sobre ventas, ahorro y negocio.
- Usa tono cercano y profesional.
- Evita rodeos y textos largos.
- Si preguntan otro tema, relaciónalo rápido con negocios.
- Usa SIEMPRE la moneda Bolivianos (Bs.). NUNCA uses dólares, pesos ni el símbolo $.

Datos del negocio:
${JSON.stringify(salesContext)}
`;

      const completion = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.5,
        max_tokens: 80,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userMessage,
          },
        ],
      });

      return (
        completion.choices[0]?.message?.content?.trim() ||
        'No pude responder. Intenta nuevamente.'
      );
    } catch (error) {
      this.logger.error(
        `CoachService error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      return 'Ocurrió un error. Intenta nuevamente.';
    }
  }
}
