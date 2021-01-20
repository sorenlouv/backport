export type RemoteConfig = {
  committedDate: string;
  file: { object: { text: string } };
};

type Ref = { name: string } | null;
type DefaultBranchRef = {
  name: string;
  target: {
    jsonConfigFile: { edges: ({ config: RemoteConfig } | undefined)[] };
  };
};

export interface GithubConfigOptionsResponse {
  repository: {
    isFork: boolean;
    ref: Ref;
    defaultBranchRef: DefaultBranchRef;
    parent: {
      id: string;
      ref: Ref;
      defaultBranchRef: DefaultBranchRef;
      owner: { login: string };
    } | null;
  };
}

export const query = /* GraphQL */ `
  query GithubConfigOptions($repoOwner: String!, $repoName: String!) {
    repository(owner: $repoOwner, name: $repoName) {
      isFork
      ...UpstreamInfo
      parent {
        ...UpstreamInfo
        owner {
          login
        }
      }
    }
  }

  fragment UpstreamInfo on Repository {
    id
    ref(qualifiedName: "refs/heads/7.x") {
      name
    }
    defaultBranchRef {
      name
      target {
        ...JSONConfigFile
        ...JSConfigFile
      }
    }
  }

  fragment JSONConfigFile on Commit {
    jsonConfigFile: history(first: 1, path: ".backportrc.json") {
      edges {
        config: node {
          committedDate
          file(path: ".backportrc.json") {
            ... on TreeEntry {
              object {
                ... on Blob {
                  text
                }
              }
            }
          }
        }
      }
    }
  }

  fragment JSConfigFile on Commit {
    jsConfigFile: history(first: 1, path: ".backportrc.js") {
      edges {
        config: node {
          committedDate
          file(path: ".backportrc.js") {
            ... on TreeEntry {
              object {
                ... on Blob {
                  text
                }
              }
            }
          }
        }
      }
    }
  }
`;
