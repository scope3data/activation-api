// PMP (Private Marketplace) types

export interface BrandAgentPMPInput {
  brandAgentId: string;
  name?: string;
  prompt: string;
}

export interface DSPSeat {
  dspName: string;
  id: string;
  seatId: string;
  seatName: string;
}

export interface DSPSeatsData {
  dspSeats: DSPSeat[];
}

export interface PMP {
  brandAgentId: string;
  createdAt: Date;
  dealIds: PMPDealId[];
  id: string;
  name: string;
  prompt: string;
  status: "active" | "draft" | "paused";
  summary: string; // Human-readable summary from backend
  updatedAt: Date;
}

export interface PMPDealId {
  dealId: string;
  ssp: string;
  status: "active" | "paused" | "pending";
}

export interface PMPsData {
  brandAgentPMPs: PMP[];
}

export interface PMPUpdateInput {
  name?: string;
  prompt?: string;
  status?: "active" | "draft" | "paused";
}
