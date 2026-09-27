export const NETWORK = 'eip155:84532';
export const ASSET = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
export const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
export function units(s) {
  if (typeof s !== 'string' || !/^(0|[1-9][0-9]{0,77})$/.test(s)) throw new Error('INVALID_AMOUNT');
  const n = BigInt(s);
  if (n > (1n << 256n)-1n) throw new Error('INVALID_AMOUNT');
  return n;
}
export function money(s) { const n=BigInt(s); return (n/1000000n)+'.'+(n%1000000n).toString().padStart(6,'0'); }
export function policyFromEnv(env=process.env) {
  const perCall=units(env.PER_CALL_MAX || '250000'), budget=units(env.RUN_BUDGET || '5000000');
  if (!perCall || !budget || perCall>budget) throw new Error('Invalid configured limits');
  if (!ADDRESS.test(env.SELLER_ADDRESS || '') || /^0x0{40}$/i.test(env.SELLER_ADDRESS)) throw new Error('Set SELLER_ADDRESS to your public testnet receiving address');
  return Object.freeze({network:NETWORK,asset:ASSET,payTo:env.SELLER_ADDRESS.toLowerCase(),perCall:perCall.toString(),budget:budget.toString()});
}
export function validateQuote(q,p) {
  if (!q || q.scheme!=='exact') throw new Error('SCHEME_NOT_ALLOWED');
  if (q.network!==p.network) throw new Error('NETWORK_NOT_ALLOWED');
  if (typeof q.asset!=='string' || q.asset.toLowerCase()!==p.asset.toLowerCase()) throw new Error('ASSET_NOT_ALLOWED');
  if (typeof q.payTo!=='string' || q.payTo.toLowerCase()!==p.payTo) throw new Error('RECIPIENT_NOT_ALLOWED');
  const amount=units(q.amount);
  if (amount===0n) throw new Error('INVALID_AMOUNT');
  if (amount>units(p.perCall)) throw new Error('PER_CALL_LIMIT');
  if (!Number.isInteger(q.maxTimeoutSeconds) || q.maxTimeoutSeconds<1 || q.maxTimeoutSeconds>300) throw new Error('INVALID_TIMEOUT');
  if (q.extra?.name!=='USDC' || q.extra?.version!=='2' || (q.extra.assetTransferMethod && q.extra.assetTransferMethod!=='eip3009')) throw new Error('DOMAIN_NOT_ALLOWED');
  return amount;
}
