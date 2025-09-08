// PMP (Private Marketplace) GraphQL queries
// These will be stubbed initially until backend provides them

export const GET_DSP_SEATS_QUERY = `
  query getDSPSeats($dsp: String!, $searchTerm: String) {
    dspSeats(dsp: $dsp, searchTerm: $searchTerm) {
      id
      dspName
      seatId
      seatName
    }
  }
`;

export const CREATE_BRAND_AGENT_PMP_MUTATION = `
  mutation createBrandAgentPMP($input: BrandAgentPMPInput!) {
    createBrandAgentPMP(input: $input) {
      id
      brandAgentId
      name
      prompt
      status
      dealIds {
        ssp
        dealId
        status
      }
      summary
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_BRAND_AGENT_PMP_MUTATION = `
  mutation updateBrandAgentPMP($id: String!, $input: PMPUpdateInput!) {
    updateBrandAgentPMP(id: $id, input: $input) {
      id
      brandAgentId
      name
      prompt
      status
      dealIds {
        ssp
        dealId
        status
      }
      summary
      updatedAt
    }
  }
`;

export const LIST_BRAND_AGENT_PMPS_QUERY = `
  query listBrandAgentPMPs($brandAgentId: String!) {
    brandAgentPMPs(brandAgentId: $brandAgentId) {
      id
      name
      status
      dealIds {
        ssp
        dealId
        status
      }
      summary
      createdAt
      updatedAt
    }
  }
`;
