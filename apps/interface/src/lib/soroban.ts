/**
 * Minimal Soroban RPC helpers for reading campaign data.
 * Uses the JSON-RPC 2.0 HTTP API — no extra SDK dependency required.
 */

const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";

// Contract IDs are stored as a comma-separated env var, e.g.:
//   NEXT_PUBLIC_CAMPAIGN_CONTRACT_IDS=CABC...,CDEF...
const CONTRACT_IDS: string[] = (
  process.env.NEXT_PUBLIC_CAMPAIGN_CONTRACT_IDS ?? ""
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

interface RpcResponse<T> {
  result?: T;
  error?: { message: string };
}

async function rpcCall<T>(method: string, params: unknown): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    next: { revalidate: 30 }, // Next.js cache: refresh every 30 s
  });
  const json: RpcResponse<T> = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result as T;
}

/** Invoke a read-only contract function and return the raw XDR result. */
async function simulateReadOnly(
  contractId: string,
  functionName: string,
  args: unknown[] = []
): Promise<string> {
  const result = await rpcCall<{ results?: { xdr: string }[] }>(
    "simulateTransaction",
    {
      transaction: buildInvokeXdr(contractId, functionName, args),
    }
  );
  const xdr = result.results?.[0]?.xdr;
  if (!xdr) throw new Error(`No result for ${functionName} on ${contractId}`);
  return xdr;
}

/**
 * Builds a minimal base64-encoded XDR envelope for a read-only invocation.
 * We rely on the RPC node to simulate it — no signing needed.
 *
 * In a production app you'd use @stellar/stellar-sdk's TransactionBuilder.
 * Here we call the `simulateTransaction` endpoint with a pre-built XDR string
 * generated via the stellar-sdk on the server, or use `getContractData` for
 * simple storage reads.
 */
function buildInvokeXdr(
  _contractId: string,
  _functionName: string,
  _args: unknown[]
): string {
  // Placeholder — replace with stellar-sdk TransactionBuilder output.
  // The RPC simulation endpoint accepts a signed or unsigned tx envelope XDR.
  throw new Error("buildInvokeXdr: integrate stellar-sdk TransactionBuilder");
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface CampaignData {
  contractId: string;
  title: string;
  description: string;
  raised: number;   // stroops → display as XLM (/1e7)
  goal: number;
  deadline: string; // ISO string derived from ledger timestamp
}

/**
 * Fetch on-chain stats for a single campaign contract.
 * Uses `getContractData` for simple scalar reads to avoid needing a full tx.
 */
export async function fetchCampaign(contractId: string): Promise<CampaignData> {
  // Each DataKey maps to a ledger entry key. We read them individually via
  // getLedgerEntries (available in Soroban RPC >= 0.0.27).
  const [titleXdr, descXdr, statsXdr] = await Promise.all([
    readInstanceEntry(contractId, "Title"),
    readInstanceEntry(contractId, "Description"),
    readInstanceEntry(contractId, "TotalRaised"),
  ]);

  return {
    contractId,
    title: decodeStringXdr(titleXdr),
    description: decodeStringXdr(descXdr),
    raised: decodeI128Xdr(statsXdr) / 1e7,
    // goal and deadline require additional reads — extend as needed
    goal: 0,
    deadline: new Date(Date.now() + 30 * 86400_000).toISOString(),
  };
}

/** Read a single instance storage entry by its DataKey symbol name. */
async function readInstanceEntry(
  contractId: string,
  keyName: string
): Promise<string> {
  // getLedgerEntries accepts base64 XDR LedgerKey values.
  // Build the key XDR for ContractData(contractId, DataKey::<keyName>, Instance).
  const keyXdr = buildInstanceKeyXdr(contractId, keyName);
  const result = await rpcCall<{ entries?: { xdr: string }[] }>(
    "getLedgerEntries",
    { keys: [keyXdr] }
  );
  const xdr = result.entries?.[0]?.xdr;
  if (!xdr) throw new Error(`Entry ${keyName} not found for ${contractId}`);
  return xdr;
}

// ── XDR helpers (stubs — replace with stellar-sdk ScVal decoders) ─────────────

function buildInstanceKeyXdr(_contractId: string, _keyName: string): string {
  throw new Error("buildInstanceKeyXdr: integrate stellar-sdk xdr module");
}

function decodeStringXdr(_xdr: string): string {
  throw new Error("decodeStringXdr: integrate stellar-sdk xdr module");
}

function decodeI128Xdr(_xdr: string): number {
  throw new Error("decodeI128Xdr: integrate stellar-sdk xdr module");
}

/**
 * Fetch all configured campaign contracts in parallel.
 * Returns successfully resolved campaigns; failed ones are silently skipped.
 */
export async function fetchAllCampaigns(): Promise<CampaignData[]> {
  if (CONTRACT_IDS.length === 0) return [];
  const results = await Promise.allSettled(
    CONTRACT_IDS.map((id) => fetchCampaign(id))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<CampaignData> => r.status === "fulfilled")
    .map((r) => r.value);
}
