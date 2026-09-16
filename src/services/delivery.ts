import { prisma } from '../db.js'; import { notifyTelegram } from './telegram.js'; import { sendDeliveryEmail } from './email.js'; import { decryptSecret } from './secure.js';
export async function fulfillOrder(orderId:string){
 const result=await prisma.$transaction(async tx=>{
  const order=await tx.order.findUnique({where:{id:orderId},include:{items:true}}); if(!order) throw new Error('Order not found');
  if(order.status==='DELIVERED'||order.status==='COMPLETED') return {order,items:[] as any[],allDelivered:true};
  const delivery=await tx.delivery.create({data:{orderId,email:order.email,status:'PENDING'}}); const delivered:any[]=[];
  for(const item of order.items){if(!item.productId) continue; const candidates=await tx.inventoryItem.findMany({where:{productId:item.productId,status:'AVAILABLE'},orderBy:{createdAt:'asc'},take:10});
    let inv:any=null;
    for(const candidate of candidates){
      const claimed=await tx.inventoryItem.updateMany({where:{id:candidate.id,status:'AVAILABLE'},data:{status:'SOLD',orderId,reservedAt:new Date(),soldAt:new Date()}});
      if(claimed.count===1){inv=candidate;break;}
    }
    if(!inv) continue;
    await tx.deliveryItem.create({data:{deliveryId:delivery.id,inventoryId:inv.id,title:item.title,value:inv.secretValue}}); delivered.push({title:item.title,value:decryptSecret(inv.secretValue)});}
  const allDelivered=delivered.length===order.items.length; await tx.delivery.update({where:{id:delivery.id},data:{status:allDelivered?'DELIVERED':'RESERVED',deliveredAt:allDelivered?new Date():null}}); const updated=await tx.order.update({where:{id:orderId},data:{status:allDelivered?'DELIVERED':'PROCESSING'}}); await tx.auditLog.create({data:{orderId,action:allDelivered?'AUTO_DELIVERED':'PAYMENT_VERIFIED_NO_STOCK',metadata:{count:delivered.length}}}); return {order:updated,items:delivered,allDelivered};
 });
 if(result.allDelivered){const emailed=await sendDeliveryEmail(result.order.email,orderId,result.items); await notifyTelegram(`✅ Order ${orderId} delivered automatically to ${result.order.email}${emailed?' (email sent)':' (email not configured)'}`);} else await notifyTelegram(`💳 Payment verified for ${orderId}; inventory is not complete. Admin action required.`);
 return result.order;
}
