import { createHmac,createHash,timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
const key=process.env.SUPABASE_SECRET_KEY;
const secret=process.env.SESSION_SECRET;
// Portal Kokurikulum: akses baca sahaja. Rekod baru hanya dalam jadual pbd_*.
const legacyReadOnly=new Set(['teachers','students','academic_sessions','classes','student_enrolments']);
const pbdTables=new Set(['pbd_subjects','pbd_teacher_access','pbd_assignments','pbd_records','pbd_login_attempts']);
export function configuration(){
 const missing:string[]=[];
 if(!url)missing.push('SUPABASE_URL');
 if(!key||key==='YOUR_SUPABASE_SECRET_KEY')missing.push('SUPABASE_SECRET_KEY');
 if(!secret||secret.length<32||secret==='GENERATE_A_RANDOM_64_CHARACTER_SECRET')missing.push('SESSION_SECRET');
 return {ready:missing.length===0,missing};
}
export async function db(table:string,method='GET',params='',payload?:unknown){
 const cfg=configuration();
 if(!cfg.ready)throw new Error('Tetapan Vercel belum lengkap: '+cfg.missing.join(', '));
 if(!legacyReadOnly.has(table)&&!pbdTables.has(table))throw new Error('Akses jadual tidak dibenarkan');
 if(legacyReadOnly.has(table)&&method!=='GET')throw new Error('Portal Koku hanya boleh dibaca, bukan diubah');
 // Supabase sb_secret_ bukan JWT. Jangan hantar sebagai Bearer.
 const headers:Record<string,string>={'apikey':key!,'Content-Type':'application/json','Prefer':method==='POST'&&params.includes('on_conflict')?'resolution=merge-duplicates,return=representation':'return=representation'};
 if(!key!.startsWith('sb_secret_'))headers.Authorization=`Bearer ${key}`;
 const res=await fetch(`${url}/rest/v1/${table}${params?`?${params}`:''}`,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload),cache:'no-store'});
 const bodyText=await res.text();
 if(!res.ok){
  if(res.status===401||res.status===403)throw new Error('Sambungan Supabase ditolak ('+res.status+'). Semak SUPABASE_SECRET_KEY di Vercel dan deploy semula.');
  throw new Error('Ralat pangkalan data ('+res.status+'). Semak sambungan di Vercel.');
 }
 try{return bodyText?JSON.parse(bodyText):[]}catch{throw new Error('Supabase tidak memulangkan data JSON yang sah')}
}
export const icHash=(ic:string)=>createHash('sha256').update(ic).digest('base64url');
type Session={id:string; exp:number};
function signature(x:string){if(!secret||secret.length<32)throw new Error('SESSION_SECRET perlu sekurang-kurangnya 32 aksara');return createHmac('sha256',secret).update(x).digest('base64url')}
export function newToken(id:string){const body=Buffer.from(JSON.stringify({id,exp:Date.now()+8*3600_000})).toString('base64url');return `${body}.${signature(body)}`}
export async function getTeacher(){const token=(await cookies()).get('sksa_pbd_session')?.value;if(!token)return null;try{const [body,sig]=token.split('.');if(!body||!sig)return null;const actual=signature(body),a=Buffer.from(actual),b=Buffer.from(sig);if(a.length!==b.length||!timingSafeEqual(a,b))return null;const p=JSON.parse(Buffer.from(body,'base64url').toString()) as Session;if(Date.now()>p.exp)return null;const teacher=await db('teachers','GET',`select=id,full_name,active&id=eq.${encodeURIComponent(p.id)}&limit=1`);if(!teacher[0]?.active)return null;const access=await db('pbd_teacher_access','GET',`select=role,enabled&teacher_id=eq.${encodeURIComponent(p.id)}&limit=1`);if(!access[0]?.enabled)return null;return {...teacher[0],role:access[0].role as 'admin'|'guru'};}catch{return null}}
export async function assigned(t:{id:string,role:string},year:number,classId:string,subjectId:string){if(t.role==='admin')return true;const rows=await db('pbd_assignments','GET',`select=id&teacher_id=eq.${t.id}&class_id=eq.${classId}&subject_id=eq.${encodeURIComponent(subjectId)}&academic_year=eq.${year}&limit=1`);return rows.length>0}
export const errorJSON=(msg:string,status=400)=>Response.json({error:msg},{status});
export const grade=(v:number)=>v>=82?'A':v>=66?'B':v>=50?'C':v>=35?'D':v>=20?'E':'F';
