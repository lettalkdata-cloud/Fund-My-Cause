import {
  Contract,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  Address,
  xdr,
  Horizon,
} from "@stellar/stellar-sdk";

const SERVER_URL = "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

export interface InitializeParams {
  contractId: string;
  creator: string;
  token: string;
  goal: bigint;
  deadline: bigint;
  minContribution: bigint;
  title: string;
  description: string;
  socialLinks?: string[];
  platformFeeAddress?: string;
  platformFeeBps?: number;
}

export async function buildInitializeTx(params: InitializeParams): Promise<string> {
  const server = new Horizon.Server(SERVER_URL);
  const account = await server.loadAccount(params.creator);

  const contract = new Contract(params.contractId);

  const socialLinksVal =
    params.socialLinks && params.socialLinks.length > 0
      ? xdr.ScVal.scvVec(params.socialLinks.map((s) => nativeToScVal(s, { type: "string" })))
      : xdr.ScVal.scvVoid();

  const platformConfigVal =
    params.platformFeeAddress && params.platformFeeBps !== undefined
      ? xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: nativeToScVal("address", { type: "symbol" }),
            val: new Address(params.platformFeeAddress).toScVal(),
          }),
          new xdr.ScMapEntry({
            key: nativeToScVal("fee_bps", { type: "symbol" }),
            val: nativeToScVal(params.platformFeeBps, { type: "u32" }),
          }),
        ])
      : xdr.ScVal.scvVoid();

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "initialize",
        new Address(params.creator).toScVal(),
        new Address(params.token).toScVal(),
        nativeToScVal(params.goal, { type: "i128" }),
        nativeToScVal(params.deadline, { type: "u64" }),
        nativeToScVal(params.minContribution, { type: "i128" }),
        nativeToScVal(params.title, { type: "string" }),
        nativeToScVal(params.description, { type: "string" }),
        socialLinksVal,
        platformConfigVal,
      ),
    )
    .setTimeout(30)
    .build();

  return tx.toXDR();
}

export async function submitSignedTx(signedXdr: string): Promise<string> {
  const server = new Horizon.Server(SERVER_URL);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = (await import("@stellar/stellar-sdk")).TransactionBuilder.fromXDR(
    signedXdr,
    NETWORK_PASSPHRASE,
  );
  const result = await server.submitTransaction(tx);
  return result.hash;
}
