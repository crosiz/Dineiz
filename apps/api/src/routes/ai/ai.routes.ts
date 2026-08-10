import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../middleware/auth';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';

const ExplainAnomalySchema = z.object({
  metric: z.string().min(1), // e.g. "net_sales"
  baseline: z.number(),
  current: z.number(),
  context: z.object({
    branchName: z.string().optional(),
    dateRange: z.string().optional(),
    notes: z.string().optional(),
  }).optional(),
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export const aiRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post('/api/ai/explain-anomaly', {
    schema: { body: ExplainAnomalySchema },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER']),
  }, async (request, reply) => {
    const { metric, baseline, current, context } = (request.body as any);

    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        explanation: `Anomaly detected for ${metric}. Current value (${current}) differs from baseline (${baseline}). Add ANTHROPIC_API_KEY to enable richer explanations.`,
        factors: [
          'Promotion/discount changes',
          'Menu availability changes',
          'Shift staffing differences',
          'Seasonality or day-of-week effects',
        ],
      };
    }

    try {
      const prompt = [
        `You are an operations analyst for a restaurant POS.`,
        `Explain a business anomaly in plain language and give actionable next steps.`,
        ``,
        `Metric: ${metric}`,
        `Baseline: ${baseline}`,
        `Current: ${current}`,
        context?.branchName ? `Branch: ${context.branchName}` : null,
        context?.dateRange ? `Date range: ${context.dateRange}` : null,
        context?.notes ? `Notes: ${context.notes}` : null,
        ``,
        `Return JSON with keys: explanation (string), likely_causes (array of strings), next_steps (array of strings).`,
      ].filter(Boolean).join('\n');

      const response = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 350,
        messages: [{ role: 'user', content: prompt }],
      });

      // @ts-ignore
      const text = response.content[0].text as string;
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }

      if (parsed && typeof parsed === 'object') return parsed;

      return { explanation: text };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to generate anomaly explanation' });
    }
  });
};



