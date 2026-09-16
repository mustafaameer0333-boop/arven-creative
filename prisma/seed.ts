import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import catalog from './catalog.json' with { type: 'json' };
import 'dotenv/config';
const prisma = new PrismaClient();
async function main(){
  const email=process.env.ADMIN_EMAIL || 'admin@example.com';
  const password=process.env.ADMIN_PASSWORD || 'CHANGE_ME_NOW';
  const passwordHash=await bcrypt.hash(password,12);
  await prisma.adminUser.upsert({where:{email},update:{passwordHash,active:true},create:{email,passwordHash}});
  for(const p of catalog as any[]){
    await prisma.product.upsert({where:{id:p.id},update:{name:p.name,title:p.title,category:p.category,seller:p.seller,supplierPrice:p.supplierPrice,price:p.price,active:p.active,deliveryType:p.deliveryType},create:{id:p.id,name:p.name,title:p.title,category:p.category,seller:p.seller,supplierPrice:p.supplierPrice,price:p.price,active:p.active,deliveryType:p.deliveryType}});
  }
  console.log(`Seeded ${catalog.length} products and admin ${email}`);
}
main().finally(()=>prisma.$disconnect());
