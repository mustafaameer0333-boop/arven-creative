import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authoritativeTotal } from '../services/pricing.js';
import { env } from '../config.js';
import { notifyTelegram } from '../services/telegram.js';
import { verifyTrc20, verifyBinancePay } from '../services/payments.js';
import { createOrderId } from '../services/order-id.js';
const router=Router();
const schema=z.object({type:z.enum(['custom','standard']).default('standard'),name:z.string().trim().min(2).max(100),email:z.string().email().max(254),paymentMethod:z.enum(['TRC20_USDT','BINANCE_PAY','MANUAL']).default('MANUAL'),txid:z.string().trim().max(200).optional().default(''),providerOrderId:z.string().trim().max(64).optional(),items:z.array(z.object({id:z.coerce.number().int().positive()})).max(50).default([]),details:z.string().max(5000).optional(),title:z.string().max(200).optional(),refs:z.string().max(1000).optional(),idempotencyKey:z.string().max(100).optional()});
router.post('/',async(req,res,next)=>{try{
 const input=schema.parse(req.body); if(input.type==='custom'){
   const id=createOrderId(); const order=await prisma.order.create({data:{id,name:input.name,email:input.email,total:0,currency:'USD',paymentMethod:'MANUAL',details:input.details,title:input.title,refs:input.refs,status:'PROCESSING'}});
   await prisma.auditLog.create({data:{orderId:order.id,action:'CUSTOM_REQUEST_CREATED'}}); await notifyTelegram(`🎨 Custom request ${order.id}\n${input.name}\n${input.email}\n${input.title||''}`); return res.status(201).json({ok:true,orderId:order.id,status:order.status});
 }
 if(!input.items.length) return res.status(400).json({ok:false,error:'No items'});
 const products=await prisma.product.findMany({where:{id:{in:input.items.map(x=>x.id)},active:true}}); const {total,items}=authoritativeTotal(products,input.items.map(x=>x.id));
 const id=createOrderId();
 const order=await prisma.order.create({data:{id,name:input.name,email:input.email,total,paymentMethod:input.paymentMethod as any,txid:input.txid||null,idempotencyKey:input.idempotencyKey||undefined,details:input.details,title:input.title,refs:input.refs,items:{create:items.map(x=>({productId:x.product.id,title:x.product.title,category:x.product.category,unitPrice:x.unit,lineTotal:x.unit}))}}});
 await prisma.payment.create({data:{orderId:id,method:input.paymentMethod as any,status:'PENDING',txid:input.txid||null,providerOrderId:input.providerOrderId||null,amount:total,currency:input.paymentMethod==='TRC20_USDT'?'USDT':'USD'}});
 await prisma.auditLog.create({data:{orderId:id,action:'ORDER_CREATED',metadata:{clientItemIds:input.items.map(x=>x.id),authoritativeTotal:total}}});
 await notifyTelegram(`🆕 New order ${id}\n${input.name}\n${input.email}\nTotal: $${total.toFixed(2)}\nPayment: ${input.paymentMethod}`);
 let verification:any=null;
 if(env.PAYMENT_AUTO_VERIFY==='true' && input.txid && input.paymentMethod==='TRC20_USDT') verification=await verifyTrc20(id,input.txid);
 if(env.PAYMENT_AUTO_VERIFY==='true' && input.providerOrderId && input.paymentMethod==='BINANCE_PAY') verification=await verifyBinancePay(id,input.providerOrderId);
 return res.status(201).json({ok:true,orderId:id,status:verification?.status||order.status,total,verification});
}catch(e){next(e)}});
router.get('/:id',async(req,res,next)=>{try{const o=await prisma.order.findUnique({where:{id:req.params.id},select:{id:true,status:true,total:true,currency:true,createdAt:true,items:{select:{title:true,quantity:true,unitPrice:true}}}}); if(!o)return res.status(404).json({ok:false,error:'Not found'}); res.json({ok:true,order:o});}catch(e){next(e)}});
export default router;
