import { randomBytes } from 'node:crypto';
import { NETWORK, ASSET } from './policy.mjs';
export async function liveSigner(key,rpcUrl) {
  if(!/^0x[0-9a-fA-F]{64}$/.test(key||'')) throw new Error('Set BUYER_PRIVATE_KEY in .env (dedicated testnet wallet)');
  const {privateKeyToAccount}=await import('viem/accounts');
  const {createPublicClient,http,parseAbi}=await import('viem');
  const {baseSepolia}=await import('viem/chains');
  const account=privateKeyToAccount(key), client=createPublicClient({chain:baseSepolia,transport:http(rpcUrl)});
  if(await client.getChainId()!==84532) throw new Error('RPC must be Base Sepolia');
  return paymentSigner(account,client);
}
export function paymentSigner(account,client){
  return {
    address:account.address,
    async sign(q,url){
      const now=BigInt(Math.floor(Date.now()/1000));
      const authorization={from:account.address,to:q.payTo,value:q.amount,validAfter:(now-60n).toString(),validBefore:(now+BigInt(q.maxTimeoutSeconds)).toString(),nonce:'0x'+randomBytes(32).toString('hex')};
      const signature=await account.signTypedData({domain:{name:'USDC',version:'2',chainId:84532,verifyingContract:ASSET},primaryType:'TransferWithAuthorization',types:{TransferWithAuthorization:[{name:'from',type:'address'},{name:'to',type:'address'},{name:'value',type:'uint256'},{name:'validAfter',type:'uint256'},{name:'validBefore',type:'uint256'},{name:'nonce',type:'bytes32'}]},message:{...authorization,value:BigInt(authorization.value),validAfter:BigInt(authorization.validAfter),validBefore:BigInt(authorization.validBefore)}});
      return {x402Version:2,resource:{url},accepted:q,payload:{signature,authorization}};
    },
    async confirm(settlement,q,payload){
      if(settlement.success!==true||settlement.network!==NETWORK||!/^0x[0-9a-fA-F]{64}$/.test(settlement.transaction||'')) throw new Error('INVALID_SETTLEMENT');
      const receipt=await client.waitForTransactionReceipt({hash:settlement.transaction,timeout:45000});
      if(receipt.status!=='success')throw new Error('SETTLEMENT_REVERTED');
      const {decodeEventLog,parseAbi}=await import('viem');
      const abi=parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)','event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)']);
      const events=receipt.logs.filter(l=>l.address.toLowerCase()===ASSET.toLowerCase()).flatMap(l=>{try{return [decodeEventLog({abi,data:l.data,topics:l.topics})]}catch{return []}});
      if(!events.some(e=>e.eventName==='Transfer'&&e.args.from.toLowerCase()===account.address.toLowerCase()&&e.args.to.toLowerCase()===q.payTo.toLowerCase()&&e.args.value===BigInt(q.amount))||!events.some(e=>e.eventName==='AuthorizationUsed'&&e.args.authorizer.toLowerCase()===account.address.toLowerCase()&&e.args.nonce===payload.payload.authorization.nonce)) throw new Error('TRANSFER_NOT_CONFIRMED');
      return settlement.transaction;
    }
  };
}
