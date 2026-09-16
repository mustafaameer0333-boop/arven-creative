import jwt from 'jsonwebtoken';
import type { Request,Response,NextFunction } from 'express';
import { env } from '../config.js';
export type AdminRequest=Request & { admin?: {id:string,email:string,role:string} };
export function signAdmin(admin:{id:string,email:string,role:string}){return jwt.sign(admin,env.JWT_SECRET,{expiresIn:'8h'});}
export function requireAdmin(req:AdminRequest,res:Response,next:NextFunction){try{const token=req.cookies?.arven_admin; if(!token) return res.status(401).json({ok:false,error:'Unauthorized'}); req.admin=jwt.verify(token,env.JWT_SECRET) as any; next();}catch{return res.status(401).json({ok:false,error:'Unauthorized'});}}
