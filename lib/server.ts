import { createHmac,createHash,timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
const key=process.env.SUPABASE_SECRET_KEY;
const secret=process.env.SESSION_SECRET;
export async function db(table:string,method='GET',params='',payload?:unknown){
 if(!url||!key)throw new Error('Konfigurasi Supabase belum lengkap');
 const res=await fetch(`${url}/rest/v1/${table}${params?`?${params}`:''}`,{method,headers:{'apikey':key,'Authorization':`Bearer ${key}`,'Content-Type':'application/json','Prefer':method==='POST'&&params.includes('on_conflict')?'resolution=merge-duplicates,return=representation':'return=representation'},body:payload===undefined?undefined:JSON.stringify(payload),cache:'no-store'});
 const text=await res.text(); if(!res.ok)throw new Error('Ralat pangkalan data: '+res.status+' '+text.slice(0,180));return text?JSON.parse(text):[];
}
export const icHash=(ic:string)=>createHash('sha256').update(ic).digest('base64url');
type Session={id:string; exp:number};
function signature(x:string){if(!secret||secret.length<32)throw new Error('SESSION_SECRET perlu sekurang-kurangnya 32 aksara');return createHmac('sha256',secret).update(x).digest('base64url')}
export function newToken(id:string){const body=Buffer.from(JSON.stringify({id,exp:Date.now()+8*3600_000})).toString('base64url');return `${body}.${signature(body)}`}
export async function getTeacher(){const token=(await cookies()).get('sksa_pbd_session')?.value;if(!token)return null;try{const [body,sig]=token.split('.');if(!body||!sig)return null;const actual=signature(body),a=Buffer.from(actual),b=Buffer.from(sig);if(a.length!==b.length||!timingSafeEqual(a,b))return null;const p=JSON.parse(Buffer.from(body,'base64url').toString()) as Session;if(Date.now()>p.exp)return null;const teacher=await db('teachers','GET',`select=id,full_name,active&id=eq.${encodeURIComponent(p.id)}&limit=1`);if(!teacher[0]?.active)return null;const access=await db('pbd_teacher_access','GET',`select=role,enabled&teacher_id=eq.${encodeURIComponent(p.id)}&limit=1`);if(!access[0]?.enabled)return null;return {...teacher[0],role:access[0].role as 'admin'|'guru'};}catch{return null}}
export async function assigned(t:{id:string,role:string},year:number,classId:string,subjectId:string){if(t.role==='admin')return true;const rows=await db('pbd_assignments','GET',`select=id&teacher_id=eq.${t.id}&class_id=eq.${classId}&subject_id=eq.${encodeURIComponent(subjectId)}&academic_year=eq.${year}&limit=1`);return rows.length>0}
export const errorJSON=(msg:string,status=400)=>Response.json({error:msg},{status});
export const grade=(v:number)=>v>=82?'A':v>=66?'B':v>=50?'C':v>=35?'D':v>=20?'E':'F';
