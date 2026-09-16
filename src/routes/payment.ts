import {Router} from 'express';
import {z} from 'zod';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import {prisma} from '../db.js';
import {verifyTrc20,verifyBinancePay} from '../services/payments.js';
import {env} from '../config.js';

const r=Router();
const verifyLimiter=rateLimit({windowMs:10*60_000,max:20,standardHeaders:true,legacyHeaders:false,message:{ok:false,error:'Too many verification attempts. Please try again later.'}});

r.post('/verify',verifyLimiter,async(req,res,next)=>{
  try{
    const b=z.object({orderId:z.string().trim().min(10).max(100),method:z.enum(['TRC20_USDT','BINANCE_PAY']),txid:z.string().trim().max(200).optional(),providerOrderId:z.string().trim().max(100).optional()}).parse(req.body);
    const result=b.method==='TRC20_USDT'?await verifyTrc20(b.orderId,b.txid||''):await verifyBinancePay(b.orderId,b.providerOrderId||b.txid||'');
    res.json(result);
  }catch(e){next(e)}
});

r.post('/binance/webhook',async(req,res,next)=>{
  try{
    if(!env.BINANCE_PAY_SECRET_KEY)return res.status(503).json({returnCode:'FAIL',returnMessage:'Not configured'});
    const timestamp=String(req.header('BinancePay-Timestamp')||'');
    const nonce=String(req.header('BinancePay-Nonce')||'');
    const signature=String(req.header('BinancePay-Signature')||'');
    const ts=Number(timestamp);
    if(!timestamp||!nonce||!signature||!Number.isFinite(ts)||Math.abs(Date.now()-ts)>5*60_000){
      return res.status(400).json({returnCode:'FAIL',returnMessage:'Invalid or expired signature'});
    }
    const raw=Buffer.isBuffer((req as any).rawBody)?(req as any).rawBody.toString('utf8'):JSON.stringify(req.body);
    const payload=`${timestamp}\n${nonce}\n${raw}\n`;
    const expected=crypto.createHmac('sha512',env.BINANCE_PAY_SECRET_KEY).update(payload).digest('hex').toUpperCase();
    const provided=signature.toUpperCase();
    if(expected.length!==provided.length||!crypto.timingSafeEqual(Buffer.from(expected,'utf8'),Buffer.from(provided,'utf8'))){
      return res.status(400).json({returnCode:'FAIL',returnMessage:'Invalid signature'});
    }
    let data:any=req.body?.data;
    if(typeof data==='string') data=JSON.parse(data);
    const merchantTradeNo=data?.merchantTradeNo;
    if(merchantTradeNo){
      const o=await prisma.order.findUnique({where:{id:merchantTradeNo}});
      if(o && data.status==='PAID') await verifyBinancePay(o.id,merchantTradeNo);
    }
    res.json({returnCode:'SUCCESS',returnMessage:null});
  }catch(e){next(e)}
});

export default r;
