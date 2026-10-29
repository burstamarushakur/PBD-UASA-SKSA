import { NextRequest,NextResponse } from 'next/server';
import { db,icHash,newToken,newExtensionCode,getTeacher,getExtensionTeacher,assigned,errorJSON,grade,configuration } from '../../../lib/server';
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
  // IDMe PBD: BI 4 kemahiran, BM 3 kemahiran. TD = Tidak Ditaksir.
  const biSkills=['Listening','Speaking','Reading','Writing'];
  const bmSkills=['Mendengar dan Bertutur','Membaca','Menulis'];
  const requiredSkills=subject==='BI'?biSkills:subject==='BM'?bmSkills:[];
  const incoming=body.skills&&typeof body.skills==='object'&&!Array.isArray(body.skills)?body.skills:{};
  const skills:Record<string,number|'TD'>={};
  if(type==='pbd'){
   for(const [skill,value] of Object.entries(incoming as Record<string,unknown>)){
    if(requiredSkills.length&&!requiredSkills.includes(skill))continue;
    if(value===undefined||value===null||value==='')continue;
    if(value!=='TD'&&(!Number.isInteger(value)||Number(value)<1||Number(value)>6))return errorJSON('TP kemahiran mesti 1–6 atau TD');
    skills[skill]=value as number|'TD';
   }
   if(Object.keys(skills).length>20)return errorJSON('Kemahiran tidak sah');
  }
  const remarks=type==='pbd'?String(body.remarks||'').trim().slice(0,1000):'';
  const effort=type==='pbd'?String(body.effort||'').trim().slice(0,200):'';
  const intervention=type==='pbd'?String(body.intervention||'').trim().slice(0,1000):'';
  const remarksValid=['CEMERLANG','SEDERHANA','LEMAH'].includes(remarks);
  const effortValid=['SANGAT TINGGI','TINGGI','SEDERHANA','RENDAH'].includes(effort);
  const skillsComplete=requiredSkills.every(skill=>skills[skill]!==undefined);
  // Status ditentukan oleh sistem sahaja; nilai status daripada browser diabaikan.
  const status=type==='uasa'?(score!==null?'lengkap':'draf'):(tp!==null&&skillsComplete&&remarksValid&&effortValid?'lengkap':'draf');
  const data={academic_year:year,class_id:body.classId,student_id:body.studentId,subject_id:subject,assessment_type:type,term,tp:type==='pbd'?tp:null,score:type==='uasa'?score:null,grade:type==='uasa'&&score!==null?grade(score):null,skills:type==='pbd'?skills:{},remarks,intervention,effort,status,updated_by:teacher.id,updated_at:new Date().toISOString()};
  const rows=await db('pbd_records','POST','on_conflict=academic_year,class_id,student_id,subject_id,assessment_type,term',data);return Response.json({ok:true,record:rows[0]});
 }
 if(teacher.role!=='admin')return errorJSON('Admin sahaja',403);
 if(action==='extension-code'){
  if(!uuid(body.teacherId))return errorJSON('Guru tidak sah');
  const [teachers,access]=await Promise.all([
   db('teachers','GET',`select=id,active&id=eq.${body.teacherId}&limit=1`),
   db('pbd_teacher_access','GET',`select=enabled&teacher_id=eq.${body.teacherId}&limit=1`)
  ]);
  if(!teachers[0]?.active||!access[0]?.enabled)return errorJSON('Guru belum diaktifkan untuk PBD/UASA',403);
  return Response.json({ok:true,...newExtensionCode(body.teacherId)});
 }
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
   return Response.json({ok:true,missing:[],message:'Neon berfungsi untuk murid, kelas, guru dan PBD/UASA.'});
  }catch(e){
   console.error('Health check failed:',e);
   return Response.json({ok:false,missing:[],message:e instanceof Error?e.message:'Ralat sambungan Supabase'},{status:503});
  }
 }
 const extensionRead=action==='extension-overview'||action==='extension-students';
 const t=extensionRead?await getExtensionTeacher(req.headers.get('authorization')):await getTeacher();
 if(!t)return errorJSON(extensionRead?'Kod extension tidak sah / tamat tempoh. Minta kod baharu daripada admin.':'Sila log masuk',401);
 try{
  if(action==='me')return Response.json({teacher:t});
  const year=safeYear(req.nextUrl.searchParams.get('year')||'2026');
  const sessions=await db('academic_sessions','GET',`select=id,year&year=eq.${year}&limit=1`);const sid=sessions[0]?.id;
  if(action==='overview'||action==='extension-overview'){
   const [subjects,allClasses,assignments]=await Promise.all([db('pbd_subjects','GET','select=*&active=eq.true&order=sort_order.asc'),sid?db('classes','GET',`select=id,name,year_level&session_id=eq.${sid}&year_level=gte.1&year_level=lte.6&order=year_level.asc,name.asc`):[],db('pbd_assignments','GET',`select=teacher_id,class_id,subject_id,academic_year&academic_year=eq.${year}${t.role==='admin'?'':`&teacher_id=eq.${t.id}`}`)]);
   const classes=t.role==='admin'?allClasses:allClasses.filter((c:any)=>assignments.some((a:any)=>a.class_id===c.id));
   const teachers=t.role==='admin'&&!extensionRead?await db('teachers','GET','select=id,full_name,active&active=eq.true&order=full_name.asc'):[];
   const access=t.role==='admin'&&!extensionRead?await db('pbd_teacher_access','GET','select=teacher_id,role,enabled'):[];
   return Response.json({teacher:t,classes,subjects,assignments,teachers,access,year});
  }
  if(action==='students'||action==='extension-students'){
   const cid=req.nextUrl.searchParams.get('classId')||'',subject=req.nextUrl.searchParams.get('subject')||'';if(!uuid(cid)||!subject)return errorJSON('Kelas/subjek diperlukan');
   if(!await assigned(t,year,cid,subject))return errorJSON('Tidak dibenarkan',403);
   const c=await db('classes','GET',`select=id,session_id,year_level&id=eq.${cid}&limit=1`);if(!c.length||c[0].session_id!==sid)return errorJSON('Kelas tidak wujud');
   const sub=await db('pbd_subjects','GET',`select=id,min_year,max_year&id=eq.${encodeURIComponent(subject)}&limit=1`);if(!sub.length||c[0].year_level<sub[0].min_year||c[0].year_level>sub[0].max_year)return errorJSON('Subjek tidak berkaitan');
   const assessmentType=extensionRead?req.nextUrl.searchParams.get('type'):null;
   const term=extensionRead?req.nextUrl.searchParams.get('term'):null;
   if(extensionRead&&(!['pbd','uasa'].includes(assessmentType||'')||!['pertengahan','akhir'].includes(term||'')))return errorJSON('Jenis pentaksiran tidak sah');
   const recordFilter=extensionRead?`&assessment_type=eq.${assessmentType}&term=eq.${term}`:'';
   const [enroll,records]=await Promise.all([db('student_enrolments','GET',`select=student_id&class_id=eq.${cid}&session_id=eq.${sid}&is_current=eq.true`),db('pbd_records','GET',`select=*&class_id=eq.${cid}&subject_id=eq.${encodeURIComponent(subject)}&academic_year=eq.${year}${recordFilter}`)]);
   const ids=enroll.map((e:any)=>e.student_id).filter((x:any)=>uuid(x));
   const pupils=ids.length?await db('students','GET',`select=id,full_name&id=in.(${ids.join(',')})`):[];
   const safeRecords=extensionRead?records.map((r:any)=>({student_id:r.student_id,academic_year:r.academic_year,class_id:r.class_id,subject_id:r.subject_id,assessment_type:r.assessment_type,term:r.term,tp:r.tp,score:r.score,skills:r.skills,remarks:r.remarks,intervention:r.intervention,effort:r.effort,status:r.status,updated_at:r.updated_at})):records;
   return Response.json({students:pupils.sort((a:any,b:any)=>a.full_name.localeCompare(b.full_name)),records:safeRecords});
  }
  return errorJSON('Endpoint tidak wujud',404);
 }catch(e){console.error(e);return errorJSON(e instanceof Error?e.message:'Ralat dalaman',500)}
}
