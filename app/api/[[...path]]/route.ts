import { NextRequest,NextResponse } from 'next/server';
import { db,icHash,newToken,getTeacher,assigned,errorJSON,grade,configuration } from '../../../lib/server';
const digits=(v:unknown)=>String(v||'').replace(/\D/g,'');
function safeYear(y:unknown){const v=Number(y);if(!Number.isInteger(v)||v<2020||v>2100)throw new Error('Tahun tidak sah');return v}
const uuid=(x:unknown)=>typeof x==='string'&&/^[a-f0-9-]{36}$/i.test(x);
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest,{params}:{params:Promise<{path?:string[]}>}){
 const action=(await params).path?.[0]||'';let body:any={};try{body=await req.json()}catch{return errorJSON('JSON tidak sah')}
 try{
 if(action==='login'){
  const ic=digits(body.ic);if(!/^\d{12}$/.test(ic))return errorJSON('Masukkan IC 12 digit');
  const fingerprint=icHash(ic+'|'+(req.headers.get('x-forwarded-for')||'unknown').split(',')[0]);
  const attempts=await db('pbd_login_attempts','GET',`select=*&fingerprint=eq.${fingerprint}&limit=1`);
  const now=Date.now(),old=attempts[0];if(old?.blocked_until&&Date.parse(old.blocked_until)>now)return errorJSON('Terlalu banyak cubaan. Cuba lagi kemudian.',429);
  const hash=icHash(ic);const result=await db('teachers','GET',`select=id,full_name,active&identification_hash=eq.${hash}&limit=1`);
  const t=result[0];const access=t?await db('pbd_teacher_access','GET',`select=role,enabled&teacher_id=eq.${t.id}&limit=1`):[];
  if(!t?.active||!access[0]?.enabled){const count=old&&now-Date.parse(old.window_start)<15*60_000?old.attempts+1:1;await db('pbd_login_attempts','POST','on_conflict=fingerprint',{fingerprint,attempts:count,window_start:count===1?new Date().toISOString():old.window_start,blocked_until:count>=5?new Date(now+15*60_000).toISOString():null});return errorJSON('IC tidak sah atau akses belum diaktifkan',401)}
  await db('pbd_login_attempts','DELETE',`fingerprint=eq.${fingerprint}`);
  const response=NextResponse.json({ok:true});response.cookies.set('sksa_pbd_session',newToken(t.id),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:8*3600});return response;
 }
 if(action==='logout'){const r=NextResponse.json({ok:true});r.cookies.delete('sksa_pbd_session');return r}
 const teacher=await getTeacher();if(!teacher)return errorJSON('Sila log masuk',401);
 if(action==='save'){
  const year=safeYear(body.year);const type=body.type,term=body.term,subject=String(body.subject||'');
  if(!uuid(body.classId)||!uuid(body.studentId)||!['pbd','uasa'].includes(type)||!['pertengahan','akhir'].includes(term))return errorJSON('Data tidak sah');
  if(type==='uasa'&&term!=='akhir')return errorJSON('UASA hanya akhir tahun');
  const classes=await db('classes','GET',`select=id,year_level,session_id&id=eq.${body.classId}&limit=1`);const c=classes[0];if(!c||c.year_level<1||c.year_level>6||type==='uasa'&&c.year_level<4)return errorJSON('Kelas tidak layak');
  const sessions=await db('academic_sessions','GET',`select=year&id=eq.${c.session_id}&limit=1`);if(sessions[0]?.year!==year)return errorJSON('Sesi kelas tidak padan');
  const enroll=await db('student_enrolments','GET',`select=id&student_id=eq.${body.studentId}&class_id=eq.${body.classId}&session_id=eq.${c.session_id}&limit=1`);if(!enroll.length)return errorJSON('Murid bukan dalam kelas ini');
  const subs=await db('pbd_subjects','GET',`select=id,min_year,max_year,active&id=eq.${encodeURIComponent(subject)}&limit=1`);if(!subs[0]?.active||c.year_level<subs[0].min_year||c.year_level>subs[0].max_year)return errorJSON('Subjek tidak ditawarkan pada tahun ini');
  if(!await assigned(teacher,year,body.classId,subject))return errorJSON('Tiada kebenaran subjek/kelas',403);
  const tp=body.tp===null||body.tp===''?null:Number(body.tp);const score=body.score===null||body.score===''?null:Number(body.score);
  if(type==='pbd'&&tp!==null&&(!Number.isInteger(tp)||tp<1||tp>6))return errorJSON('TP mesti 1 hingga 6');
  if(type==='uasa'&&score!==null&&(!Number.isFinite(score)||score<0||score>100))return errorJSON('Markah mesti 0–100');
  const skills=typeof body.skills==='object'&&body.skills&&!Array.isArray(body.skills)?body.skills:{};
  if(Object.keys(skills).length>20||Object.values(skills).some(v=>v!==''&&(typeof v!=='number'||!Number.isInteger(v as number)||(v as number)<1||(v as number)>6)))return errorJSON('Kemahiran tidak sah');
  const data={academic_year:year,class_id:body.classId,student_id:body.studentId,subject_id:subject,assessment_type:type,term,tp:type==='pbd'?tp:null,score:type==='uasa'?score:null,grade:type==='uasa'&&score!==null?grade(score):null,skills:type==='pbd'?skills:{},remarks:String(body.remarks||'').slice(0,1000),intervention:String(body.intervention||'').slice(0,1000),effort:String(body.effort||'').slice(0,200),status:['draf','lengkap','tidak_berkaitan','tidak_hadir'].includes(body.status)?body.status:'draf',updated_by:teacher.id,updated_at:new Date().toISOString()};
  const rows=await db('pbd_records','POST','on_conflict=academic_year,class_id,student_id,subject_id,assessment_type,term',data);return Response.json({ok:true,record:rows[0]});
 }
 if(teacher.role!=='admin')return errorJSON('Admin sahaja',403);
 if(action==='access'){
  if(!uuid(body.teacherId))return errorJSON('Guru tidak sah');
  const role=body.role==='admin'?'admin':'guru';if(body.teacherId===teacher.id&&(!body.enabled||role!=='admin'))return errorJSON('Admin tidak boleh nyahaktif diri');
  await db('pbd_teacher_access','POST','on_conflict=teacher_id',{teacher_id:body.teacherId,role,enabled:!!body.enabled});return Response.json({ok:true});
 }
 if(action==='assign'){
  const year=safeYear(body.year);if(!uuid(body.teacherId)||!uuid(body.classId)||!body.subject)return errorJSON('Penetapan tidak lengkap');
  const c=await db('classes','GET',`select=id,session_id,year_level&id=eq.${body.classId}&limit=1`);const s=c[0]?await db('academic_sessions','GET',`select=year&id=eq.${c[0].session_id}&limit=1`):[];const sub=await db('pbd_subjects','GET',`select=id,min_year,max_year&id=eq.${encodeURIComponent(body.subject)}&limit=1`);
  if(s[0]?.year!==year||!sub.length||c[0].year_level<sub[0].min_year||c[0].year_level>sub[0].max_year)return errorJSON('Kelas atau subjek tidak sepadan');
  if(body.remove)await db('pbd_assignments','DELETE',`teacher_id=eq.${body.teacherId}&class_id=eq.${body.classId}&subject_id=eq.${encodeURIComponent(body.subject)}&academic_year=eq.${year}`);
  else await db('pbd_assignments','POST','on_conflict=teacher_id,class_id,subject_id,academic_year',{teacher_id:body.teacherId,class_id:body.classId,subject_id:body.subject,academic_year:year});return Response.json({ok:true});
 }
 return errorJSON('Endpoint tidak wujud',404);
 }catch(e){console.error(e);return errorJSON(e instanceof Error?e.message:'Ralat dalaman',500)}
}
export async function GET(req:NextRequest,{params}:{params:Promise<{path?:string[]}>}){
 const action=(await params).path?.[0]||'';
 if(action==='health'){
  const cfg=configuration();
  if(!cfg.ready)return Response.json({ok:false,missing:cfg.missing,message:'Environment Variables Vercel belum lengkap.'},{status:503});
  try{
   await Promise.all([db('teachers','GET','select=id&limit=1'),db('pbd_subjects','GET','select=id&limit=1')]);
   return Response.json({ok:true,missing:[],message:'Sambungan baca Portal Koku dan pangkalan data PBD berasingan berjaya.'});
  }catch(e){
   console.error('Health check failed:',e);
   return Response.json({ok:false,missing:[],message:e instanceof Error?e.message:'Ralat sambungan Supabase'},{status:503});
  }
 }
 const t=await getTeacher();if(!t)return errorJSON('Sila log masuk',401);
 try{
  if(action==='me')return Response.json({teacher:t});
  const year=safeYear(req.nextUrl.searchParams.get('year')||'2026');
  const sessions=await db('academic_sessions','GET',`select=id,year&year=eq.${year}&limit=1`);const sid=sessions[0]?.id;
  if(action==='overview'){
   const [subjects,allClasses,assignments]=await Promise.all([db('pbd_subjects','GET','select=*&active=eq.true&order=sort_order.asc'),sid?db('classes','GET',`select=id,name,year_level&session_id=eq.${sid}&year_level=gte.1&year_level=lte.6&order=year_level.asc,name.asc`):[],db('pbd_assignments','GET',`select=teacher_id,class_id,subject_id,academic_year&academic_year=eq.${year}${t.role==='admin'?'':`&teacher_id=eq.${t.id}`}`)]);
   const classes=t.role==='admin'?allClasses:allClasses.filter((c:any)=>assignments.some((a:any)=>a.class_id===c.id));
   const teachers=t.role==='admin'?await db('teachers','GET','select=id,full_name,active&active=eq.true&order=full_name.asc'):[];
   const access=t.role==='admin'?await db('pbd_teacher_access','GET','select=teacher_id,role,enabled'):[];
   return Response.json({teacher:t,classes,subjects,assignments,teachers,access,year});
  }
  if(action==='students'){
   const cid=req.nextUrl.searchParams.get('classId')||'',subject=req.nextUrl.searchParams.get('subject')||'';if(!uuid(cid)||!subject)return errorJSON('Kelas/subjek diperlukan');
   if(!await assigned(t,year,cid,subject))return errorJSON('Tidak dibenarkan',403);
   const c=await db('classes','GET',`select=id,session_id,year_level&id=eq.${cid}&limit=1`);if(!c.length||c[0].session_id!==sid)return errorJSON('Kelas tidak wujud');
   const sub=await db('pbd_subjects','GET',`select=id,min_year,max_year&id=eq.${encodeURIComponent(subject)}&limit=1`);if(!sub.length||c[0].year_level<sub[0].min_year||c[0].year_level>sub[0].max_year)return errorJSON('Subjek tidak berkaitan');
   const [enroll,records]=await Promise.all([db('student_enrolments','GET',`select=student_id,students(id,full_name)&class_id=eq.${cid}&session_id=eq.${sid}&is_current=eq.true`),db('pbd_records','GET',`select=*&class_id=eq.${cid}&subject_id=eq.${encodeURIComponent(subject)}&academic_year=eq.${year}`)]);
   return Response.json({students:enroll.map((e:any)=>e.students).filter(Boolean).sort((a:any,b:any)=>a.full_name.localeCompare(b.full_name)),records});
  }
  return errorJSON('Endpoint tidak wujud',404);
 }catch(e){console.error(e);return errorJSON(e instanceof Error?e.message:'Ralat dalaman',500)}
}
