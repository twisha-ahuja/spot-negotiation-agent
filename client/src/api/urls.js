// Base URL configurations for API environments
export const BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://preprod.lorri.in";

// Agent specific router base
export const AGENT_API_BASE = `${BASE_URL}/api/agent`;
// Autocomplete router base
export const AUTOCOMPLETE_API = `${BASE_URL}/api/apiuser/autocomplete`;