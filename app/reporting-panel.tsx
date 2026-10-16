'use client';
import {useEffect,useMemo,useState} from 'react';
type Klass={id:string;name:string;year_level:number};
type Subject={id:string;name:string;min_year:number;max_year:number};
type Assignment={class_id:string;subject_id:string;academic_year:number};
type Summary={total:number;complete:number;draft:number;missing:number;excluded:number;completion:number;meanTp:number|null;meanScore:number|null};
type ChartPoint={label:string;value:number};
type Analytics={
 meta:{year:number;type:'pbd'|'uasa';term:string;scope:string;subjectName:string;classCount:number;title:string};
 summary:Summary;tpDistribution:ChartPoint[];gradeDistribution:ChartPoint[];
 skillDistribution:{name:string;counts:ChartPoint[]}[];
 perClass:{id:string;name:string;summary:Summary}[];
 attention:{name:string;className:string;note:string}[];
};
type Props={year:number;role:'admin'|'guru';classes:Klass[];subjects:Subject[];assignments:Assignment[]};
const palette=['#ca5c61','#eda065','#e2c166','#6ab9c7','#4d92dc','#389b81','#8496af'];
const num=(n:number|null)=>n===null?'–':String(n);
function GraphBars({values,title}:{values:ChartPoint[];title:string}){
 const max=Math.max(1,...values.map(v=>v.value));
 return <section className="reportChart">
  <h3>{title}</h3>
  <div className="reportVerticalBars">{values.map((v,i)=><div key={v.label} className="reportVColumn">
   <strong>{v.value}</strong><div className="reportVBarTrack"><div className="reportVBar" style={{height:(v.value/max*100)+'%',background:palette[i%palette.length]}}/></div>
   <span>{v.label}</span>
  </div>)}</div>
  <small>Kiraan berdasarkan rekod berstatus lengkap sahaja.</small>
 </section>;
}
function StatusDonut({summary}:{summary:Summary}){
 const total=summary.total||1;
 const a=summary.complete/total*100,b=summary.draft/total*100,c=summary.missing/total*100;
 return <section className="reportChart">
  <h3>Status Pengisian</h3><div className="reportDonutRow">
   <div className="reportDonut" role="img" aria-label={'Lengkap '+summary.complete+', draf '+summary.draft+', belum isi '+summary.missing+', dikecualikan '+summary.excluded} style={{background:'conic-gradient(#23866d 0% '+a+'%,#f3b24f '+a+'% '+(a+b)+'%,#dd7979 '+(a+b)+'% '+(a+b+c)+'%,#cad6e3 '+(a+b+c)+'% 100%)'}}>
    <div><strong>{summary.completion.toFixed(1)}%</strong><small>lengkap</small></div>
   </div>
   <div className="reportDonutLegend"><div><i style={{background:'#23866d'}}/>Lengkap <b>{summary.complete}</b></div><div><i style={{background:'#f3b24f'}}/>Draf <b>{summary.draft}</b></div><div><i style={{background:'#dd7979'}}/>Belum isi <b>{summary.missing}</b></div><div><i style={{background:'#cad6e3'}}/>Dikecualikan <b>{summary.excluded}</b></div></div>
  </div></section>;
}
export default function ReportingPanel({year,role,classes,subjects,assignments}:Props){
 const isAdmin=role==='admin';
 const [kind,KIND]=useState<'pbd'|'uasa'>('pbd');
 const [scope,SCOPE]=useState<'class'|'year'|'school'>('class');
 const [selectedClass,CID]=useState('');
 const [selectedLevel,LEVEL]=useState(4);
 const [selectedSubject,SUB]=useState('');
 const [term,TERM]=useState('akhir');
 const [report,REPORT]=useState<Analytics|null>(null);
 const [busy,BUSY]=useState(false);
 const [error,ERROR]=useState('');
 const eligibleClasses=useMemo(()=>classes.filter(c=>kind==='pbd'||c.year_level>=4),[classes,kind]);
 const actualClass=eligibleClasses.find(c=>c.id===selectedClass)||eligibleClasses[0];
 const actualLevel=kind==='uasa'&&selectedLevel<4?4:selectedLevel;
 const filteredSubjects=subjects.filter(s=>{
  const matches=scope==='class'?actualClass&&actualClass.year_level>=s.min_year&&actualClass.year_level<=s.max_year:
   scope==='year'?actualLevel>=s.min_year&&actualLevel<=s.max_year:
   eligibleClasses.some(c=>c.year_level>=s.min_year&&c.year_level<=s.max_year);
  if(!matches)return false;
  if(isAdmin)return true;
  return !!actualClass&&assignments.some(a=>a.class_id===actualClass.id&&a.subject_id===s.id&&a.academic_year===year);
 });
 const actualSubject=filteredSubjects.find(s=>s.id===selectedSubject)||filteredSubjects[0];
 useEffect(()=>{REPORT(null);ERROR('')},[kind,scope,selectedClass,selectedSubject,selectedLevel,term,year]);
 const params=new URLSearchParams({year:String(year),type:kind,term:kind==='uasa'?'akhir':term,scope:isAdmin?scope:'class',subject:actualSubject?.id||'',format:'json'});
 if((isAdmin?scope:'class')==='class'&&actualClass)params.set('classId',actualClass.id);
 if(scope==='year'&&isAdmin)params.set('level',String(actualLevel));
 const pdfParams=new URLSearchParams(params);pdfParams.set('format','pdf');
 const ready=!!actualSubject&&((scope==='class'&&!!actualClass)||scope==='year'||scope==='school');
 const pdfUrl='/api/report?'+pdfParams.toString();
 async function analyze(){
  if(!ready)return;
  BUSY(true);ERROR('');
  try{
   const response=await fetch('/api/report?'+params.toString(),{cache:'no-store'});
   const content=await response.json();
   if(!response.ok)throw Error(content.error||'Analisis gagal dijana');
   REPORT(content as Analytics);
  }catch(err){ERROR(err instanceof Error?err.message:'Ralat analisis');REPORT(null)}
  finally{BUSY(false)}
 }
 return <div className="reportPanel">
  <section className="panel reportIntro">
   <div className="reportIntroTop"><div><div className="eyebrow">SKSA · PENTAKSIRAN</div><h2>{isAdmin?'Pusat Analisis & Laporan':'Muat Turun Laporan PDF'}</h2><p>{isAdmin?'Lihat graf, kemajuan, perbandingan kelas dan jana PDF rasmi.':'PDF hanya bagi kelas dan subjek yang admin agihkan kepada anda.'}</p></div><div className="reportRole">{isAdmin?'🔒 ADMIN SAHAJA':'✓ AKSES GURU'}</div></div>
   <div className="reportFilterGrid">
    <div><label>Jenis Pentaksiran</label><select value={kind} onChange={e=>{KIND(e.target.value as 'pbd'|'uasa');CID('');SUB('')}}><option value="pbd">PBD · Tahun 1–6</option><option value="uasa">UASA · Tahun 4–6</option></select></div>
    {isAdmin&&<div><label>Skop Laporan</label><select value={scope} onChange={e=>{SCOPE(e.target.value as 'class'|'year'|'school');SUB('')}}><option value="class">Satu Kelas</option><option value="year">Satu Tahun</option><option value="school">Seluruh Sekolah</option></select></div>}
    {(scope==='class'||!isAdmin)&&<div><label>Kelas</label><select value={actualClass?.id||''} onChange={e=>{CID(e.target.value);SUB('')}}>{eligibleClasses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
    {scope==='year'&&isAdmin&&<div><label>Tahun</label><select value={actualLevel} onChange={e=>{LEVEL(Number(e.target.value));SUB('')}}>{[1,2,3,4,5,6].filter(n=>kind==='pbd'||n>=4).map(n=><option key={n} value={n}>Tahun {n}</option>)}</select></div>}
    <div><label>Mata Pelajaran</label><select value={actualSubject?.id||''} onChange={e=>SUB(e.target.value)}>{filteredSubjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
    {kind==='pbd'&&<div><label>Penggal</label><select value={term} onChange={e=>TERM(e.target.value)}><option value="pertengahan">Pertengahan Tahun</option><option value="akhir">Akhir Tahun</option></select></div>}
   </div>
   <div className="reportActions">
    {isAdmin&&<button type="button" className="primary" onClick={analyze} disabled={busy||!ready}>{busy?'Sedang menganalisis...':'📊 Jana Analisis Data'}</button>}
    {ready?<a className="reportDownload" href={pdfUrl} download>↓ Muat Turun PDF {kind.toUpperCase()}</a>:<span className="reportDisabled">Pilih kelas dan subjek dahulu</span>}
   </div>
   {error&&<p className="reportError" role="alert">{error}</p>}
   <p className="reportPrivacy">Data diambil daripada rekod sebenar mengikut tahun, subjek dan penggal. Rekod Draf / Belum Isi ditunjukkan berasingan dan tidak dikira sebagai pencapaian rendah.</p>
  </section>
  {isAdmin&&report&&<div className="reportResults">
   <section className="reportMetrics">
    <div><small>Jumlah Murid</small><strong>{report.summary.total}</strong></div>
    <div><small>Rekod Lengkap</small><strong>{report.summary.complete}</strong></div>
    <div><small>Belum Isi / Draf</small><strong>{report.summary.missing+report.summary.draft}</strong></div>
    <div><small>{kind==='pbd'?'Purata TP':'Purata Markah'}</small><strong>{num(kind==='pbd'?report.summary.meanTp:report.summary.meanScore)}</strong></div>
   </section>
   <div className="reportGraphs"><GraphBars values={kind==='pbd'?report.tpDistribution:report.gradeDistribution} title={kind==='pbd'?'Taburan TP Keseluruhan':'Taburan Gred A–F'}/><StatusDonut summary={report.summary}/></div>
   {kind==='pbd'&&report.skillDistribution.length>0&&<section className="panel reportSkillPanel"><h2>Analisis Mengikut Kemahiran</h2><p>Taburan setiap TP bagi murid yang sudah lengkap diisi; TD diasingkan.</p><div className="reportLegend">{['TP1','TP2','TP3','TP4','TP5','TP6','TD'].map((k,i)=><span key={k}><i style={{background:palette[i]}}/>{k}</span>)}</div>
    {report.skillDistribution.map(s=>{const total=s.counts.reduce((a,x)=>a+x.value,0);return <div className="reportSkillRow" key={s.name}><strong>{s.name}</strong><div className="reportSkillTrack">{s.counts.map((x,i)=>x.value>0&&<div key={x.label} title={x.label+': '+x.value} style={{width:total?x.value/total*100+'%':'0%',background:palette[i]}}/>)}</div><small>{total} direkod</small></div>})}
   </section>}
   <section className="panel reportCompare"><h2>Perbandingan Mengikut Kelas</h2><div className="reportCompareList">{report.perClass.map(c=><div className="reportCompareRow" key={c.id}><span>{c.name}</span><div><div style={{width:c.summary.completion+'%'}}/></div><b>{c.summary.completion.toFixed(1)}%</b><small>{kind==='pbd'?'Purata TP':'Purata Markah'}: {num(kind==='pbd'?c.summary.meanTp:c.summary.meanScore)}</small></div>)}</div></section>
   {report.attention.length>0&&<section className="panel reportAttention"><h2>Rekod Perlu Perhatian</h2><p>Murid belum isi, masih draf atau mempunyai pencapaian rendah. Paparan maksimum 150 murid.</p><div className="reportAttentionList">{report.attention.map((item,i)=><div key={i}><span>{item.className}</span><b>{item.name}</b><em>{item.note}</em></div>)}</div></section>}
  </div>}
 </div>;
}
