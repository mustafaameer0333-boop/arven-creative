import crypto from 'node:crypto';
import { prisma } from '../db.js';
import { env } from '../config.js';
import { fulfillOrder } from './delivery.js';

function binanceHeaders(body:string){
  if(!env.BINANCE_PAY_API_KEY || !env.BINANCE_PAY_SECRET_KEY || !env.BINANCE_PAY_CERTIFICATE_SN) throw new Error('Binance Pay credentials are not configured');
  const timestamp=Date.now().toString();
  const nonce=crypto.randomBytes(16).toString('hex');
  const payload=`${timestamp}\n${nonce}\n${body}\n`;
  const signature=crypto.createHmac('sha512',env.BINANCE_PAY_SECRET_KEY).update(payload).digest('hex').toUpperCase();
  return {'content-type':'application/json','BinancePay-Timestamp':timestamp,'BinancePay-Nonce':nonce,'BinancePay-Certificate-SN':env.BINANCE_PAY_CERTIFICATE_SN,'BinancePay-Signature':signature};
}

export async function queryBinancePay(providerOrderId:string){
  const merchantTradeNo=providerOrderId.replace(/[^A-Za-z0-9]/g,'').slice(0,32);
  if(!merchantTradeNo) throw new Error('Invalid Binance merchant trade number');
  const body=JSON.stringify({merchantTradeNo,prepayId:null});
  const r=await fetch(`${env.BINANCE_PAY_BASE_URL}/binancepay/openapi/order/query`,{method:'POST',headers:binanceHeaders(body),body});
  const data:any=await r.json(); if(!r.ok || data.status!=='SUCCESS') throw new Error(data.errorMessage||'Binance Pay query failed'); return data.data;
}

export async function verifyTrc20(orderId:string,txid:string){
  if(!env.TRON_RECEIVING_ADDRESS) throw new Error('TRON_RECEIVING_ADDRESS is not configured');
  const order=await prisma.order.findUnique({where:{id:orderId},include:{payments:true}}); if(!order) throw new Error('Order not found');
  if(order.payments.some(p=>p.txid===txid && p.status==='VERIFIED')) return {ok:true,status:'already_verified'};
  const url=new URL(`${env.TRONGRID_BASE_URL}/v1/accounts/${env.TRON_RECEIVING_ADDRESS}/transactions/trc20`);
  url.searchParams.set('limit','200'); url.searchParams.set('only_confirmed','true'); url.searchParams.set('only_to','true'); url.searchParams.set('contract_address',env.USDT_TRC20_CONTRACT); url.searchParams.set('order_by','block_timestamp,desc');
  const headers:any={}; if(env.TRONGRID_API_KEY) headers['TRON-PRO-API-KEY']=env.TRONGRID_API_KEY;
  const r=await fetch(url,{headers}); const data:any=await r.json(); if(!r.ok) throw new Error(data?.error||'TronGrid query failed');
  const match=(data.data||[]).find((t:any)=>String(t.transaction_id||t.txID||'').toLowerCase()===txid.toLowerCase());
  if(!match) return {ok:false,status:'not_found'};
  const decimals=Number(match.token_info?.decimals ?? 6); const amount=Number(match.value)/10**decimals; const expected=Number(order.total);
  if(Math.abs(amount-expected)>0.000001) return {ok:false,status:'amount_mismatch',received:amount,expected};
  const existing=await prisma.payment.findFirst({where:{txid}}); if(existing && existing.orderId!==orderId) return {ok:false,status:'txid_already_used'};
  await prisma.$transaction(async tx=>{
    await tx.payment.upsert({where:{id:(order.payments[0]?.id||'__missing__')},update:{status:'VERIFIED',txid,amount,currency:'USDT',verifiedAt:new Date(),raw:match},create:{orderId,method:'TRC20_USDT',status:'VERIFIED',txid,amount,currency:'USDT',verifiedAt:new Date(),raw:match}});
    await tx.order.update({where:{id:orderId},data:{status:'PAYMENT_VERIFIED',txid}});
    await tx.auditLog.create({data:{orderId,action:'PAYMENT_VERIFIED',metadata:{method:'TRC20_USDT',txid,amount}}});
  });
  await fulfillOrder(orderId);
  return {ok:true,status:'verified',received:amount};
}

export async function verifyBinancePay(orderId:string,providerOrderId:string){
  const order=await prisma.order.findUnique({where:{id:orderId}}); if(!order) throw new Error('Order not found');
  const data=await queryBinancePay(providerOrderId);
  const expected=Number(order.total), received=Number(data.totalFee);
  if(data.status!=='PAID') return {ok:false,status:data.status};
  if(data.currency!=='USDT' && String(data.currency).toUpperCase()!=='USD') return {ok:false,status:'currency_mismatch',currency:data.currency};
  if(Math.abs(expected-received)>0.000001) return {ok:false,status:'amount_mismatch',received,expected};
  await prisma.$transaction(async tx=>{
    await tx.payment.upsert({where:{id:`binance:${orderId}`},update:{status:'VERIFIED',providerOrderId,amount:received,currency:data.currency,verifiedAt:new Date(),raw:data},create:{id:`binance:${orderId}`,orderId,method:'BINANCE_PAY',status:'VERIFIED',providerOrderId,amount:received,currency:data.currency,verifiedAt:new Date(),raw:data}});
    await tx.order.update({where:{id:orderId},data:{status:'PAYMENT_VERIFIED',txid:data.transactionId||providerOrderId}});
    await tx.auditLog.create({data:{orderId,action:'BINANCE_PAY_VERIFIED',metadata:{providerOrderId,transactionId:data.transactionId}}});
  });
  await fulfillOrder(orderId); return {ok:true,status:'verified'};
}
