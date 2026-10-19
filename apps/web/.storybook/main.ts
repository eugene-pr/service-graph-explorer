import type { StorybookConfig } from '@storybook/react-vite';

// Builds with vite.config.ts, so Tailwind and the domain package resolve as in the app.
const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: [
    { directory: '../src/atoms', files: '**/*.stories.tsx', titlePrefix: 'Atoms' },
    { directory: '../src/molecules', files: '**/*.stories.tsx', titlePrefix: 'Molecules' },
  ],
};

export default config;
