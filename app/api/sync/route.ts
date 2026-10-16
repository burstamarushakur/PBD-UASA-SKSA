import { NextRequest,NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
export const runtime='nodejs';
export const dynamic='force-dynamic';
// Schedule controlled by Vercel Cron. This never writes to Supabase Koku.
type SourceRow=Record<string,unknown>;
type DataName='academic_sessions'|'teachers'|'classes'|'students'|'student_enrolments';
const columns:Record<DataName,string[]>={
 academic_sessions:['id','year','name'],
 teachers:['id','full_name','active','identification_hash'],
 classes:['id','name','year_level','session_id'],
 students:['id','full_name','active','idme_student_id'],
 student_enrolments:['id','student_id','session_id','class_id','is_current']
};
const number=(x:unknown)=>Array.isArray(x)?x.length:0;
export async function GET(request:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)
  return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 const url=process.env.KOKU_SYNC_ENDPOINT,token=process.env.KOKU_SYNC_TOKEN,dbUrl=process.env.PBD_DATABASE_URL;
 if(!url||!token||!dbUrl)return NextResponse.json({ok:false,error:'Sync config missing'},{status:503});
 try{
  const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('Source unavailable ('+response.status+')');
  const source=await response.json() as {ok:boolean,data?:Record<DataName,SourceRow[]>};
  if(!source.ok||!source.data)throw new Error('Source returned invalid dataset');
  const data=source.data;
  const count=Object.fromEntries(Object.entries(data).map(([key,value])=>[key,number(value)]));
  // Guard against partial/accidentally empty source responses.
  if(number(data.teachers)<10||number(data.students)<100||number(data.classes)<15||number(data.student_enrolments)<100||number(data.academic_sessions)<1)
   throw new Error('Source snapshot incomplete; no changes applied');
  const classRows=data.classes.filter(c=>Number(c.year_level)>=1&&Number(c.year_level)<=6);
  const classIds=new Set(classRows.map(c=>String(c.id)));
  const enrollments=data.student_enrolments.filter(e=>classIds.has(String(e.class_id)));
  const studentIds=new Set(enrollments.map(e=>String(e.student_id)));
  const students=data.students.filter(s=>studentIds.has(String(s.id)));
  const sessions=data.academic_sessions.filter(s=>Number(s.year)>=2026);
  const filtered:Record<DataName,SourceRow[]>={
   academic_sessions:sessions,
   teachers:data.teachers,
   classes:classRows,
   students,
   student_enrolments:enrollments
  };
  const db=neon(dbUrl);
  // Database writes are strictly on Neon source SNAPSHOT tables.
  for(const table of ['academic_sessions','teachers','classes','students','student_enrolments'] as DataName[]){
   const fields=columns[table];const names=fields.map(c=>'"'+c+'"').join(',');
   const changes=fields.filter(c=>c!=='id').map(c=>'"'+c+'"=EXCLUDED."'+c+'"').join(',');
   for(let i=0;i<filtered[table].length;i+=100){
    const batch=filtered[table].slice(i,i+100);
    const query=`INSERT INTO public."${table}" (${names}) SELECT ${names} FROM jsonb_populate_recordset(null::public."${table}", $1::jsonb) ON CONFLICT (id) DO UPDATE SET ${changes}`;
    await db.query(query,[JSON.stringify(batch)]);
   }
  }
  // Preserve history and assessment references while removing outdated current-class membership.
  const enrollmentIds=enrollments.map(e=>String(e.id));
  await db.query('UPDATE public.student_enrolments SET is_current=false WHERE is_current=true AND NOT (id=ANY($1::uuid[]))',[enrollmentIds]);
  const teacherIds=data.teachers.map(t=>String(t.id));
  await db.query('UPDATE public.teachers SET active=false WHERE NOT (id=ANY($1::uuid[]))',[teacherIds]);
  await db.query("INSERT INTO public.pbd_sync_metadata(id,last_sync,note) VALUES(1,now(),$1) ON CONFLICT(id) DO UPDATE SET last_sync=EXCLUDED.last_sync,note=EXCLUDED.note",[JSON.stringify(count)]);
  return NextResponse.json({ok:true,updated:count,at:new Date().toISOString()});
 }catch(error){console.error('PBD Neon sync failed',error);return NextResponse.json({ok:false,error:'Sync failed; no data removed'},{status:503})}
}
