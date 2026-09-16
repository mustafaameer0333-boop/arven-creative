import {env} from '../config.js';
export async function sendDeliveryEmail(to:string,orderId:string,items:{title:string,value:string}[]){
 if(!env.RESEND_API_KEY||!env.DELIVERY_FROM_EMAIL){console.warn('Delivery email not configured; order remains delivered in database but customer email is not sent.'); return false;}
 const html=`<h2>ARVÉN Creative — Your order</h2><p>Order: <b>${orderId}</b></p><p>Thank you. Your digital delivery is below:</p><ul>${items.map(x=>`<li><b>${x.title}</b><br><code>${x.value}</code></li>`).join('')}</ul>`;
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({from:env.DELIVERY_FROM_EMAIL,to:[to],subject:`ARVÉN Creative — Order ${orderId}`,html})}); if(!r.ok){console.error('Resend failed',await r.text());return false;} return true;
}
