import { DataResponse } from '../../../../src/services/github/fetchCommitsByAuthor';

export const commitsWithPullRequestsMock: DataResponse = {
  repository: {
    ref: {
      target: {
        history: {
          edges: [
            {
              node: {
                oid: 'myCommitSha',
                message: '[APM] Some long git commit message (#1337)',
                associatedPullRequests: {
                  edges: [
                    {
                      node: {
                        number: 1337,
                        timelineItems: {
                          edges: [
                            {
                              node: {
                                source: {
                                  __typename: 'PullRequest',
                                  state: 'MERGED',
                                  commits: {
                                    edges: [
                                      {
                                        node: {
                                          commit: {
                                            message:
                                              '[APM] Some long git commit message (#1337)'
                                          }
                                        }
                                      }
                                    ]
                                  },
                                  baseRefName: '7.x'
                                }
                              }
                            },
                            {
                              node: {
                                source: {
                                  __typename: 'PullRequest',
                                  state: 'CLOSED',
                                  commits: {
                                    edges: [
                                      {
                                        node: {
                                          commit: {
                                            message:
                                              '[APM] Some long git commit message (#1337)'
                                          }
                                        }
                                      }
                                    ]
                                  },
                                  baseRefName: '7.1'
                                }
                              }
                            },
                            {
                              node: {
                                source: {
                                  __typename: 'PullRequest',
                                  state: 'MERGED',
                                  commits: {
                                    edges: [
                                      {
                                        node: {
                                          commit: {
                                            message:
                                              '[APM] Some long git commit message (#1337)'
                                          }
                                        }
                                      }
                                    ]
                                  },
                                  baseRefName: '7.2'
                                }
                              }
                            }
                          ]
                        }
                      }
                    }
                  ]
                }
              }
            },
            {
              node: {
                oid: 'myGitHash2',
                message:
                  '[APM] Refactor ESClient to allow other operations than `search` (#37334)',
                associatedPullRequests: {
                  edges: [
                    {
                      node: {
                        number: 37334,
                        timelineItems: {
                          edges: [
                            {
                              node: {
                                source: {
                                  __typename: 'PullRequest',
                                  state: 'MERGED',
                                  commits: {
                                    edges: [
                                      {
                                        node: {
                                          commit: {
                                            message:
                                              '[APM] Refactor ESClient to allow other operations than `search` (#37334)'
                                          }
                                        }
                                      }
                                    ]
                                  },
                                  baseRefName: '7.x'
                                }
                              }
                            }
                          ]
                        }
                      }
                    }
                  ]
                }
              }
            },
            {
              node: {
                oid: 'myGitHash3',
                message:
                  '[APM] Fix issue with missing agentName on metrics page (#37210)',
                associatedPullRequests: {
                  edges: [
                    {
                      node: {
                        number: 37210,
                        timelineItems: {
                          edges: [
                            {
                              node: {
                                source: {
                                  __typename: 'PullRequest',
                                  state: 'MERGED',
                                  commits: {
                                    edges: [
                                      {
                                        node: {
                                          commit: {
                                            message:
                                              '[APM] Fix issue with missing agentName on metrics page (#37210)'
                                          }
                                        }
                                      }
                                    ]
                                  },
                                  baseRefName: '7.x'
                                }
                              }
                            },
                            {
                              node: {
                                source: {
                                  __typename: 'PullRequest',
                                  state: 'MERGED',
                                  commits: {
                                    edges: [
                                      {
                                        node: {
                                          commit: {
                                            message:
                                              '[APM] Fix issue with missing agentName on metrics page (#37210)'
                                          }
                                        }
                                      }
                                    ]
                                  },
                                  baseRefName: '7.2'
                                }
                              }
                            },
                            {
                              node: {
                                source: {
                                  __typename: 'PullRequest',
                                  state: 'MERGED',
                                  commits: {
                                    edges: [
                                      {
                                        node: {
                                          commit: {
                                            message:
                                              '[APM] Fix issues with metric charts when `noHits=true`'
                                          }
                                        }
                                      },
                                      {
                                        node: {
                                          commit: {
                                            message: 'Fix tests'
                                          }
                                        }
                                      },
                                      {
                                        node: {
                                          commit: {
                                            message: 'Rename to getEmptySeries'
                                          }
                                        }
                                      }
                                    ]
                                  },
                                  baseRefName: 'master'
                                }
                              }
                            }
                          ]
                        }
                      }
                    }
                  ]
                }
              }
            }
          ]
        }
      }
    }
  }
};

export const commitsWithoutPullRequestsMock: DataResponse = {
  repository: {
    ref: {
      target: {
        history: {
          edges: [
            {
              node: {
                oid: 'myOtherGitHash',
                message: 'My other git commit message',
                associatedPullRequests: {
                  edges: []
                }
              }
            }
          ]
        }
      }
    }
  }
};
