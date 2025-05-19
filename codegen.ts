import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  schema: './schema.graphql',
  documents: ['src/**/*.ts'],

  ignoreNoDocuments: true,

  generates: {
    'src/graphql/generated/': {
      preset: 'client-preset',
      presetConfig: {
        gqlTagName: 'graphql',
        fragmentMasking: false,
      },
      config: {
        skipTypename: false, // Include __typename
        withHooks: false, // Disable React hooks
        urqlImportFrom: '@urql/core',
      },
    },
  },
  hooks: {
    afterAllFileWrite: ['prettier --write'],
  },
};

export default config;
