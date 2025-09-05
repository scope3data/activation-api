interface Agent {
  description?: string;
  id: string;
  models?: Array<{
    description?: string;
    id: string;
    name: string;
  }>;
  name: string;
}

interface AgentsData {
  agents: Agent[];
}

interface AgentWhereInput {
  customerId?: { equals?: number };
  id?: { equals?: string };
  name?: { contains?: string };
  // Add other filtering options as needed
}

interface GraphQLError {
  locations?: Array<{ column: number; line: number }>;
  message: string;
  path?: string[];
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

export class Scope3ApiClient {
  private readonly graphqlUrl: string;

  constructor(graphqlUrl: string = "https://api.scope3.com/api/graphql") {
    this.graphqlUrl = graphqlUrl;
  }

  async getAgents(
    apiKey: string,
    where: AgentWhereInput = {},
  ): Promise<Agent[]> {
    const query = `
      query Agents($where: AgentWhereInput) {
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

    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query,
        variables: { where },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result = (await response.json()) as GraphQLResponse<AgentsData>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.agents) {
      throw new Error("No data received");
    }

    return result.data.agents;
  }
}
