// codegen.ts
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: './schema.graphql',
  documents: 'src/lib/github/v4/graphqlQueries/**/*.graphql',
  generates: {
    './src/graphql/generated.ts': {
      plugins: [
        'typescript', // base types for the GitHub schema
        'typescript-operations', // types for each Query/Mutation + Variables
        'typescript-graphql-request', // generate getSdk() for graphql-request
      ],
      config: {
        rawRequest: true,
      },
    },
  },

  // (optional) run prettier on the generated file
  hooks: {
    afterAllFileWrite: ['prettier --write'],
  },
};

export default config;
