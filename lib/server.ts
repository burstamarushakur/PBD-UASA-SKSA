import { createHmac,createHash,timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
const key=process.env.SUPABASE_SECRET_KEY;
const neonUrl=process.env.PBD_DATABASE_URL;
const secret=process.env.SESSION_SECRET;
// Portal Kokurikulum: akses baca sahaja. Rekod baru hanya dalam jadual pbd_*.
const legacyReadOnly=new Set(['teachers','students','academic_sessions','classes','student_enrolments']);
const pbdTables=new Set(['pbd_subjects','pbd_teacher_access','pbd_assignments','pbd_records','pbd_login_attempts']);
export function configuration(){
 const missing:string[]=[];
 if(!neonUrl||!neonUrl.startsWith('postgres'))missing.push('PBD_DATABASE_URL');
 if(!secret||secret.length<32)missing.push('SESSION_SECRET');
 return {ready:missing.length===0,missing};
}

const tableColumns:Record<string,Set<string>>={
 teachers:new Set(['id','full_name','active','identification_hash']),
 students:new Set(['id','full_name','active']),
 academic_sessions:new Set(['id','year','name']),
 classes:new Set(['id','name','year_level','session_id']),
 student_enrolments:new Set(['id','student_id','session_id','class_id','is_current']),
 pbd_subjects:new Set(['id','name','short_name','min_year','max_year','skills','is_elective','active','sort_order']),
 pbd_teacher_access:new Set(['teacher_id','role','enabled','created_at']),
 pbd_assignments:new Set(['id','teacher_id','class_id','subject_id','academic_year','created_at']),
 pbd_records:new Set(['id','academic_year','class_id','student_id','subject_id','assessment_type','term','tp','skills','remarks','intervention','effort','status','score','grade','updated_by','updated_at']),
 pbd_login_attempts:new Set(['fingerprint','attempts','window_start','blocked_until'])
};
function neonStatement(table:string,method:string,params:string,payload:unknown){
 const cols=tableColumns[table];
 if(!cols)throw Error('Jadual Neon tidak dibenarkan');
 const qs=new URLSearchParams(params), values:unknown[]=[];
 const args:string[]=[];
 const bind=(v:unknown)=>{values.push(v);return '
 const ident=(col:string)=>{if(!cols.has(col))throw Error('Kolum tidak sah: '+col);return '"'+col+'"'};
 if(method==='GET'||method==='DELETE'){
  const fields=method==='DELETE'?['*']:(qs.get('select')||'*').split(',').map(x=>x.trim());
  const projection=fields.length===1&&fields[0]==='*'?'*':fields.map(ident).join(', ');
  for(const [key,raw] of qs.entries()){
   if(['select','order','limit','offset'].includes(key))continue;
   const dot=raw.indexOf('.');const op=raw.slice(0,dot),value=raw.slice(dot+1);
   if(dot<0||!['eq','gte','lte','gt','lt','neq','in'].includes(op))throw Error('Penapis query tidak sah');
   if(op==='in'){
    if(!value.startsWith('(')||!value.endsWith(')'))throw Error('Senarai ID tidak sah');
    const ids=value.slice(1,-1).split(',').filter(Boolean);
    if(!ids.length||ids.length>1000)throw Error('Senarai ID tidak sah');
    args.push(ident(key)+' IN ('+ids.map(bind).join(',')+')');
   }else{
    const sign:Record<string,string>={eq:'=',gte:'>=',lte:'<=',gt:'>',lt:'<',neq:'<>'};
    args.push(ident(key)+' '+sign[op]+' '+bind(value));
   }
  }
  const where=args.length?' WHERE '+args.join(' AND '):'';
  if(method==='DELETE')return {sql:'DELETE FROM public."'+table+'"'+where+' RETURNING *',values};
  let query='SELECT '+projection+' FROM public."'+table+'"'+where;
  const order=qs.get('order');
  if(order){const [field,direction]=order.split('.');query+=' ORDER BY '+ident(field)+' '+(direction==='desc'?'DESC':'ASC')}
  const limit=qs.get('limit');if(limit!==null){const n=Number(limit);if(!Number.isInteger(n)||n<1||n>5000)throw Error('Had query tidak sah');query+=' LIMIT '+n}
  return {sql:query,values};
 }
 if(method!=='POST'||!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Operasi database tidak disokong');
 const data=payload as Record<string,unknown>,keys=Object.keys(data);
 if(!keys.length)throw Error('Rekod kosong');
 const fields=keys.map(ident);
 const placeholders=keys.map(k=>bind(data[k]&&typeof data[k]==='object'?JSON.stringify(data[k]):data[k]));
 let statement='INSERT INTO public."'+table+'" ('+fields.join(',')+') VALUES ('+placeholders.join(',')+')';
 const conflict=qs.get('on_conflict');
 if(conflict){
  const conflictFields=conflict.split(',').map(x=>ident(x.trim()));
  const updates=keys.filter(k=>!conflict.split(',').includes(k)).map(k=>ident(k)+'=EXCLUDED.'+ident(k));
  statement+=' ON CONFLICT ('+conflictFields.join(',')+') DO '+(updates.length?'UPDATE SET '+updates.join(', '):'NOTHING');
 }
 return {sql:statement+' RETURNING *',values};
}
export async function db(table:string,method='GET',params='',payload?:unknown){
 const cfg=configuration();
 if(!cfg.ready)throw new Error('Tetapan pelayan belum lengkap: '+cfg.missing.join(', '));
 if(legacyReadOnly.has(table)&&method!=='GET')throw Error('Data asal Koku dalam Neon hanya boleh dibaca');
 if(!legacyReadOnly.has(table)&&!pbdTables.has(table))throw Error('Jadual tidak dibenarkan');
 const query=neonStatement(table,method,params,payload);
 const sql=neon(neonUrl!);
 return await sql.query(query.sql,query.values as any[]);
}

export const icHash=(ic:string)=>createHash('sha256').update(ic).digest('base64url');
type Session={id:string; exp:number};
function signature(x:string){if(!secret||secret.length<32)throw new Error('SESSION_SECRET perlu sekurang-kurangnya 32 aksara');return createHmac('sha256',secret).update(x).digest('base64url')}
export function newToken(id:string){const body=Buffer.from(JSON.stringify({id,exp:Date.now()+8*3600_000})).toString('base64url');return `${body}.${signature(body)}`}
export async function getTeacher(){const token=(await cookies()).get('sksa_pbd_session')?.value;if(!token)return null;try{const [body,sig]=token.split('.');if(!body||!sig)return null;const actual=signature(body),a=Buffer.from(actual),b=Buffer.from(sig);if(a.length!==b.length||!timingSafeEqual(a,b))return null;const p=JSON.parse(Buffer.from(body,'base64url').toString()) as Session;if(Date.now()>p.exp)return null;const teacher=await db('teachers','GET',`select=id,full_name,active&id=eq.${encodeURIComponent(p.id)}&limit=1`);if(!teacher[0]?.active)return null;const access=await db('pbd_teacher_access','GET',`select=role,enabled&teacher_id=eq.${encodeURIComponent(p.id)}&limit=1`);if(!access[0]?.enabled)return null;return {id:String(teacher[0].id),full_name:String(teacher[0].full_name),active:teacher[0].active===true,role:access[0].role as 'admin'|'guru'};}catch{return null}}
export async function assigned(t:{id:string,role:string},year:number,classId:string,subjectId:string){if(t.role==='admin')return true;const rows=await db('pbd_assignments','GET',`select=id&teacher_id=eq.${t.id}&class_id=eq.${classId}&subject_id=eq.${encodeURIComponent(subjectId)}&academic_year=eq.${year}&limit=1`);return rows.length>0}
export const errorJSON=(msg:string,status=400)=>Response.json({error:msg},{status});
export const grade=(v:number)=>v>=82?'A':v>=66?'B':v>=50?'C':v>=35?'D':v>=20?'E':'F';
+values.length};
 const ident=(col:string)=>{if(!cols.has(col))throw Error('Kolum tidak sah: '+col);return '"'+col+'"'};
 if(method==='GET'||method==='DELETE'){
  const fields=method==='DELETE'?['*']:(qs.get('select')||'*').split(',').map(x=>x.trim());
  const projection=fields.length===1&&fields[0]==='*'?'*':fields.map(ident).join(', ');
  for(const [key,raw] of qs.entries()){
   if(['select','order','limit','offset'].includes(key))continue;
   const dot=raw.indexOf('.');const op=raw.slice(0,dot),value=raw.slice(dot+1);
   if(dot<0||!['eq','gte','lte','gt','lt','neq','in'].includes(op))throw Error('Penapis query tidak sah');
   if(op==='in'){
    if(!value.startsWith('(')||!value.endsWith(')'))throw Error('Senarai ID tidak sah');
    const ids=value.slice(1,-1).split(',').filter(Boolean);
    if(!ids.length||ids.length>1000)throw Error('Senarai ID tidak sah');
    args.push(ident(key)+' IN ('+ids.map(bind).join(',')+')');
   }else{
    const sign:Record<string,string>={eq:'=',gte:'>=',lte:'<=',gt:'>',lt:'<',neq:'<>'};
    args.push(ident(key)+' '+sign[op]+' '+bind(value));
   }
  }
  const where=args.length?' WHERE '+args.join(' AND '):'';
  if(method==='DELETE')return {sql:'DELETE FROM public."'+table+'"'+where+' RETURNING *',values};
  let query='SELECT '+projection+' FROM public."'+table+'"'+where;
  const order=qs.get('order');
  if(order){const [field,direction]=order.split('.');query+=' ORDER BY '+ident(field)+' '+(direction==='desc'?'DESC':'ASC')}
  const limit=qs.get('limit');if(limit!==null){const n=Number(limit);if(!Number.isInteger(n)||n<1||n>5000)throw Error('Had query tidak sah');query+=' LIMIT '+n}
  return {sql:query,values};
 }
 if(method!=='POST'||!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Operasi database tidak disokong');
 const data=payload as Record<string,unknown>,keys=Object.keys(data);
 if(!keys.length)throw Error('Rekod kosong');
 const fields=keys.map(ident);
 const placeholders=keys.map(k=>bind(data[k]&&typeof data[k]==='object'?JSON.stringify(data[k]):data[k]));
 let statement='INSERT INTO public."'+table+'" ('+fields.join(',')+') VALUES ('+placeholders.join(',')+')';
 const conflict=qs.get('on_conflict');
 if(conflict){
  const conflictFields=conflict.split(',').map(x=>ident(x.trim()));
  const updates=keys.filter(k=>!conflict.split(',').includes(k)).map(k=>ident(k)+'=EXCLUDED.'+ident(k));
  statement+=' ON CONFLICT ('+conflictFields.join(',')+') DO '+(updates.length?'UPDATE SET '+updates.join(', '):'NOTHING');
 }
 return {sql:statement+' RETURNING *',values};
}
export async function db(table:string,method='GET',params='',payload?:unknown){
 const cfg=configuration();
 if(!cfg.ready)throw new Error('Tetapan pelayan belum lengkap: '+cfg.missing.join(', '));
 if(legacyReadOnly.has(table)&&method!=='GET')throw Error('Data asal Koku dalam Neon hanya boleh dibaca');
 if(!legacyReadOnly.has(table)&&!pbdTables.has(table))throw Error('Jadual tidak dibenarkan');
 const query=neonStatement(table,method,params,payload);
 const sql=neon(neonUrl!);
 return await sql.query(query.sql,query.values as any[]);
}

export const icHash=(ic:string)=>createHash('sha256').update(ic).digest('base64url');
type Session={id:string; exp:number};
function signature(x:string){if(!secret||secret.length<32)throw new Error('SESSION_SECRET perlu sekurang-kurangnya 32 aksara');return createHmac('sha256',secret).update(x).digest('base64url')}
export function newToken(id:string){const body=Buffer.from(JSON.stringify({id,exp:Date.now()+8*3600_000})).toString('base64url');return `${body}.${signature(body)}`}
export async function getTeacher(){const token=(await cookies()).get('sksa_pbd_session')?.value;if(!token)return null;try{const [body,sig]=token.split('.');if(!body||!sig)return null;const actual=signature(body),a=Buffer.from(actual),b=Buffer.from(sig);if(a.length!==b.length||!timingSafeEqual(a,b))return null;const p=JSON.parse(Buffer.from(body,'base64url').toString()) as Session;if(Date.now()>p.exp)return null;const teacher=await db('teachers','GET',`select=id,full_name,active&id=eq.${encodeURIComponent(p.id)}&limit=1`);if(!teacher[0]?.active)return null;const access=await db('pbd_teacher_access','GET',`select=role,enabled&teacher_id=eq.${encodeURIComponent(p.id)}&limit=1`);if(!access[0]?.enabled)return null;return {id:String(teacher[0].id),full_name:String(teacher[0].full_name),active:teacher[0].active===true,role:access[0].role as 'admin'|'guru'};}catch{return null}}
export async function assigned(t:{id:string,role:string},year:number,classId:string,subjectId:string){if(t.role==='admin')return true;const rows=await db('pbd_assignments','GET',`select=id&teacher_id=eq.${t.id}&class_id=eq.${classId}&subject_id=eq.${encodeURIComponent(subjectId)}&academic_year=eq.${year}&limit=1`);return rows.length>0}
export const errorJSON=(msg:string,status=400)=>Response.json({error:msg},{status});
export const grade=(v:number)=>v>=82?'A':v>=66?'B':v>=50?'C':v>=35?'D':v>=20?'E':'F';
