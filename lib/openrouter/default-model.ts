export const defaultOpenRouterModelConfig = {
  model: "moonshotai/kimi-k2.5",
  provider: {
    only: ["Fireworks"]
  }
} as const;

export type OpenRouterModelConfig = typeof defaultOpenRouterModelConfig;
