import {NextRequest} from 'next/server';
import {db,icHash,newIcExtensionSession,errorJSON} from '../../../lib/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const WINDOW=15*60_000;
// IC checked against the existing approved teacher database. No portal cookie set.
export async function POST(req:NextRequest){
 if(req.headers.get('content-type')?.split(';')[0].trim()!=='application/json')
  return errorJSON('Hanya permintaan JSON dibenarkan',415);
 let body:unknown;
 try{body=await req.json()}catch{return errorJSON('JSON tidak sah')}
 if(!body||typeof body!=='object'||Array.isArray(body))return errorJSON('Maklumat log masuk tidak sah');
 const ic=(body as Record<string,unknown>).ic;
 if(typeof ic!=='string'||!/^[0-9]{12}$/.test(ic))return errorJSON('IC perlu 12 digit tanpa sengkang');
 try{
  const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim().slice(0,100);
  const perIp=icHash('extension-ip|'+ip);
  const perTeacher=icHash('extension-teacher|'+ip+'|'+ic);
  const now=Date.now();
  const [ips,people]=await Promise.all([
   db('pbd_login_attempts','GET','select=*&fingerprint=eq.'+perIp+'&limit=1'),
   db('pbd_login_attempts','GET','select=*&fingerprint=eq.'+perTeacher+'&limit=1')
  ]);
  const ipOld=ips[0], userOld=people[0];
  const active=(o:any)=>o&&Number.isFinite(Date.parse(o.window_start))&&now-Date.parse(o.window_start)<WINDOW;
  if((active(ipOld)&&Number(ipOld.attempts)>=60)||(active(userOld)&&Number(userOld.attempts)>=5))
   return errorJSON('Terlalu banyak percubaan. Cuba lagi selepas 15 minit.',429);
  const count=active(ipOld)?Number(ipOld.attempts)+1:1;
  await db('pbd_login_attempts','POST','on_conflict=fingerprint',{
   fingerprint:perIp,attempts:count,
   window_start:active(ipOld)?ipOld.window_start:new Date(now).toISOString(),
   blocked_until:count>=60?new Date(now+WINDOW).toISOString():null
  });
  const hash=icHash(ic);
  const teacherRows=await db('teachers','GET','select=id,full_name,active&identification_hash=eq.'+hash+'&limit=1');
  const teacher=teacherRows[0];
  const access=teacher?await db('pbd_teacher_access','GET','select=role,enabled&teacher_id=eq.'+encodeURIComponent(teacher.id)+'&limit=1'):[];
  if(!teacher?.active||!access[0]?.enabled){
   const failCount=active(userOld)?Number(userOld.attempts)+1:1;
   await db('pbd_login_attempts','POST','on_conflict=fingerprint',{
    fingerprint:perTeacher,attempts:failCount,
    window_start:active(userOld)?userOld.window_start:new Date(now).toISOString(),
    blocked_until:failCount>=5?new Date(now+WINDOW).toISOString():null
   });
   return errorJSON('IC tidak sah atau guru belum diaktifkan oleh admin',401);
  }
  if(userOld)await db('pbd_login_attempts','DELETE','fingerprint=eq.'+perTeacher);
  return Response.json({ok:true,...newIcExtensionSession(String(teacher.id)),
   teacher:{full_name:teacher.full_name,role:access[0].role}},{headers:{'Cache-Control':'no-store','Pragma':'no-cache'}});
 }catch(e){
  console.error('Extension IC login failed:',e);
  return errorJSON('Ralat pengesahan guru. Cuba lagi kemudian.',500);
 }
}
