export interface AuthContext {
  customerId?: number;
  scope3ApiKey: string;
  userId?: string;
}

export interface ServerConfig {
  endpoint: string;
  port: number;
  scope3GraphQLUrl: string;
}
