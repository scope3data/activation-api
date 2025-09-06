export const GET_API_ACCESS_KEYS_QUERY = `
  query GetAPIAccessKeys {
    getAPIAccessKeys {
      tokens {
        customerId
        id
        name
      }
    }
  }
`;
