/** Never used by visual fixtures: telemetry rejects without a server request. */
export const supabaseAdmin = {
  rpc: async () => ({ data: false, error: null }),
  from: () => ({ insert: async () => ({ error: null }) }),
};
