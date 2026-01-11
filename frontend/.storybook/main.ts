import type { StorybookConfig } from '@storybook/preact-vite';
import tailwindcss from '@tailwindcss/vite';

const config: StorybookConfig = {
  "stories": [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  "addons": [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs"
  ],
  "framework": "@storybook/preact-vite",
  async viteFinal(config) {
    config.plugins = config.plugins || [];
    config.plugins.push(tailwindcss());
    return config;
  },
};
export default config;