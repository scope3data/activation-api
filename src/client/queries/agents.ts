export const GET_AGENTS_QUERY = `
  query GetAgents($where: AgentWhereInput) {
    agents(where: $where) {
      id
      name
      description
      models {
        id
        name
        description
      }
    }
  }
`;
