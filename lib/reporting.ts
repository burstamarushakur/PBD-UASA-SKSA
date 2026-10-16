import {db,assigned,getTeacher} from './server';

export type ReportType='pbd'|'uasa';
export type Scope='class'|'year'|'school';
export type ReportStudent={
 id:string;name:string;classId:string;className:string;level:number;
 status:'lengkap'|'draf'|'belum_isi'|'tidak_hadir'|'tidak_berkaitan';
 tp:number|null;score:number|null;grade:string|null;
 skills:Record<string,number|'TD'>;remarks:string;effort:string;intervention:string;
};
export type ReportSummary={
 total:number;complete:number;draft:number;missing:number;excluded:number;completion:number;
 meanTp:number|null;meanScore:number|null;
};
export type ReportBundle={
 meta:{year:number;type:ReportType;term:string;scope:Scope;level:number|null;subjectId:string;subjectName:string;title:string;generatedAt:string;classCount:number;classNames:string[]};
 summary:ReportSummary;
 tpDistribution:{label:string;value:number}[];
 gradeDistribution:{label:string;value:number}[];
 skillDistribution:{name:string;counts:{label:string;value:number}[]}[];
 perClass:{id:string;name:string;level:number;summary:ReportSummary}[];
 attention:{name:string;className:string;note:string}[];
 rows:ReportStudent[];
};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BI=['Listening','Speaking','Reading','Writing'];
const BM=['Mendengar dan Bertutur','Membaca','Menulis'];
const dist=(labels:string[])=>labels.map(label=>({label,value:0}));
const avg=(arr:number[])=>arr.length?Math.round(arr.reduce((a,b)=>a+b,0)/arr.length*10)/10:null;
function summarize(rows:ReportStudent[]):ReportSummary{
 const complete=rows.filter(r=>r.status==='lengkap');
 const draft=rows.filter(r=>r.status==='draf').length;
 const excluded=rows.filter(r=>r.status==='tidak_hadir'||r.status==='tidak_berkaitan').length;
 const missing=rows.filter(r=>r.status==='belum_isi').length;
 const considered=rows.length-excluded;
 return {
  total:rows.length,complete:complete.length,draft,missing,excluded,
  completion:considered?Math.round(complete.length/considered*1000)/10:0,
  meanTp:avg(complete.map(r=>r.tp).filter((x):x is number=>typeof x==='number')),
  meanScore:avg(complete.map(r=>r.score).filter((x):x is number=>typeof x==='number'))
 };
}
function toYear(x:string|null){const v=Number(x);if(!Number.isInteger(v)||v<2020||v>2100)throw Error('Tahun tidak sah');return v}
export function reportParams(p:URLSearchParams){
 const year=toYear(p.get('year'));
 const type=p.get('type')==='uasa'?'uasa':p.get('type')==='pbd'?'pbd':null;
 const scope=p.get('scope');
 const term=type==='uasa'?'akhir':p.get('term');
 const subject=(p.get('subject')||'').trim();
 const classId=p.get('classId')||'';
 const level=p.get('level')?Number(p.get('level')):null;
 if(!type||!['class','year','school'].includes(scope||'')||!['pertengahan','akhir'].includes(term||'')||!/^[a-zA-Z0-9_-]{1,24}$/.test(subject))throw Error('Penapis laporan tidak sah');
 if(scope==='class'&&!UUID.test(classId))throw Error('Pilih kelas yang sah');
 if(scope==='year'&&(!Number.isInteger(level)||!level||level<1||level>6))throw Error('Pilih Tahun 1 hingga 6');
 if(type==='uasa'&&scope==='year'&&Number(level)<4)throw Error('UASA hanya Tahun 4 hingga 6');
 return {year,type,scope:scope as Scope,term:term!,subject,classId,level};
}
export async function buildReport(teacher:NonNullable<Awaited<ReturnType<typeof getTeacher>>>,p:URLSearchParams):Promise<ReportBundle>{
 const {year,type,scope,term,subject,classId,level}=reportParams(p);
 if(teacher.role!=='admin'&&scope!=='class')throw Error('Analisis sekolah hanya untuk admin. Guru boleh eksport PDF kelas agihan sendiri.');
 const [session,sub]=await Promise.all([
  db('academic_sessions','GET',`select=id,year&year=eq.${year}&limit=1`),
  db('pbd_subjects','GET',`select=id,name,min_year,max_year,active,skills&id=eq.${encodeURIComponent(subject)}&limit=1`)
 ]);
 if(!session[0])throw Error('Sesi persekolahan belum disediakan');
 if(!sub[0]?.active)throw Error('Mata pelajaran tidak dijumpai');
 const sid=String(session[0].id);
 const classes=await db('classes','GET',`select=id,name,year_level&session_id=eq.${sid}&year_level=gte.1&year_level=lte.6&order=year_level.asc`);
 const chosen=classes.filter((c:any)=>{
  const eligible=c.year_level>=sub[0].min_year&&c.year_level<=sub[0].max_year&&(type==='pbd'||c.year_level>=4);
  if(!eligible)return false;
  return scope==='class'?c.id===classId:scope==='year'?c.year_level===level:true;
 });
 if(!chosen.length)throw Error('Tiada kelas untuk penapis dipilih');
 if(teacher.role!=='admin'&&!await assigned(teacher,year,classId,subject))throw Error('Anda tidak mempunyai agihan bagi kelas dan subjek ini');
 const classSet=new Set(chosen.map((x:any)=>x.id));
 const [enroll,pupils,rawRecords]=await Promise.all([
  db('student_enrolments','GET',`select=student_id,class_id&session_id=eq.${sid}&is_current=eq.true`),
  db('students','GET','select=id,full_name,active'),
  db('pbd_records','GET',`select=student_id,class_id,status,tp,score,grade,skills,remarks,effort,intervention&academic_year=eq.${year}&subject_id=eq.${encodeURIComponent(subject)}&assessment_type=eq.${type}&term=eq.${term}`)
 ]);
 const studentMap=new Map(pupils.filter((s:any)=>s.active!==false).map((s:any)=>[s.id,s.full_name] as const));
 const recordMap=new Map(rawRecords.map((r:any)=>[r.class_id+'|'+r.student_id,r] as const));
 const classMap=new Map(chosen.map((c:any)=>[c.id,c] as const));
 const rows:ReportStudent[]=[];
 const seen=new Set<string>();
 for(const e of enroll){
  if(!classSet.has(e.class_id)||!studentMap.has(e.student_id))continue;
  const identifier=e.class_id+'|'+e.student_id;if(seen.has(identifier))continue;seen.add(identifier);
  const student=studentMap.get(e.student_id) as string;
  const cls=classMap.get(e.class_id) as any;
  const record=recordMap.get(identifier) as any;
  const status=record?(['lengkap','draf','tidak_hadir','tidak_berkaitan'].includes(record.status)?record.status:'draf'):'belum_isi';
  rows.push({
   id:e.student_id,name:student,classId:cls.id,className:cls.name,level:cls.year_level,status,
   tp:record?.tp==null?null:Number(record.tp),
   score:record?.score==null?null:Number(record.score),
   grade:record?.grade||null,
   skills:record?.skills&&typeof record.skills==='object'&&!Array.isArray(record.skills)?record.skills:{},
   remarks:record?.remarks||'',effort:record?.effort||'',intervention:record?.intervention||''
  });
 }
 rows.sort((a,b)=>a.level-b.level||a.className.localeCompare(b.className)||a.name.localeCompare(b.name));
 const skillNames=subject==='BI'?BI:subject==='BM'?BM:(Array.isArray(sub[0].skills)?sub[0].skills:[]);
 const completed=rows.filter(r=>r.status==='lengkap');
 const tps=dist(['TP1','TP2','TP3','TP4','TP5','TP6']);
 const grades=dist(['A','B','C','D','E','F']);
 for(const r of completed){
  if(r.tp!==null&&r.tp>=1&&r.tp<=6)tps[r.tp-1].value++;
  const g=grades.find(v=>v.label===r.grade);if(g)g.value++;
 }
 const skillDistribution=skillNames.map((name:string)=>{
  const counts=dist(['TP1','TP2','TP3','TP4','TP5','TP6','TD']);
  for(const r of completed){
   const v=r.skills[name];
   if(v==='TD')counts[6].value++;
   else if(typeof v==='number'&&v>=1&&v<=6)counts[v-1].value++;
  }
  return {name,counts};
 });
 const perClass=chosen.map((c:any)=>{
  const items=rows.filter(r=>r.classId===c.id);
  return {id:c.id,name:c.name,level:Number(c.year_level),summary:summarize(items)};
 });
 const attention=rows.filter(r=>r.status==='belum_isi'||r.status==='draf'||(r.status==='lengkap'&&(type==='pbd'?r.tp!==null&&r.tp<=2:r.score!==null&&r.score<40))).slice(0,150).map(r=>({name:r.name,className:r.className,note:r.status==='belum_isi'?'Belum isi':r.status==='draf'?'Draf':type==='pbd'?'TP '+r.tp:'Markah '+r.score}));
 const target=scope==='class'?chosen[0].name:scope==='year'?'TAHUN '+level:'SELURUH SEKOLAH';
 const title=(type==='pbd'?'PBD':'UASA')+' - '+sub[0].name+' - '+target;
 return {
  meta:{year,type,term,scope,level:scope==='year'?level:null,subjectId:subject,subjectName:sub[0].name,title,generatedAt:new Date().toISOString(),classCount:chosen.length,classNames:chosen.map((x:any)=>x.name)},
  summary:summarize(rows),tpDistribution:tps,gradeDistribution:grades,skillDistribution,perClass,attention,rows
 };
}
