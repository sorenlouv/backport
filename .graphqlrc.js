require('dotenv').config({ path: `${__dirname}/.env` });

const accessToken = process.env.GITHUB_TOKEN;

module.exports = {
  schema: 'schema.graphql',
  documents: ['./**/*.ts'],
  extensions: {
    endpoints: {
      'GitHub API V4': {
        url: 'https://api.github.com/graphql',
        headers: {
          Authorization: `bearer ${accessToken}`,
          'user-agent': 'JS GraphQL',
        },
      },
    },
  },
};
