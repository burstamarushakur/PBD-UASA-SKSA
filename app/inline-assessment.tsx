'use client';
import {useMemo,useState} from 'react';

type Pupil={id:string;full_name:string};
type Assessment={
 id:string;student_id:string;term:string;assessment_type:string;
 tp:number|null;score:number|null;grade:string|null;
 skills:Record<string,number|'TD'>;remarks:string;intervention:string;
 effort:string;status:string;
};
type Props={
 students:Pupil[];records:Assessment[];year:number;classId:string;
 subject:string;subjectName:string;type:string;term:string;
 skills:readonly string[];search:string;
 onBusy:(message:string)=>void;onIdle:()=>void;
 onSaved:(record:Assessment)=>void;
 onSuccess:(message:string)=>void;onError:(message:string)=>void;
};
const TP=[1,2,3,4,5,6];
const COMMENTS=['CEMERLANG','SEDERHANA','LEMAH'];
const EFFORTS=['SANGAT TINGGI','TINGGI','SEDERHANA','RENDAH'];
function newDraft(studentId:string,existing:Assessment|undefined,term:string,type:string):Assessment{
 if(existing)return {...existing,skills:{...(existing.skills||{})}};
 return {id:'',student_id:studentId,term,assessment_type:type,tp:null,score:null,grade:null,skills:{},remarks:'',intervention:'',effort:'',status:'draf'};
}
function gradeFor(score:number|null){
 if(score===null)return '–';
 return score>=82?'A':score>=66?'B':score>=50?'C':score>=35?'D':score>=20?'E':'F';
}
async function saveToServer(payload:unknown):Promise<Assessment>{
 let result:Response;
 try{result=await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'})}
 catch{throw Error('Sambungan terputus. Semak internet dan cuba semula.')}
 const data=await result.json().catch(()=>null);
 if(!result.ok||!data?.record)throw Error(data?.error||'Gagal simpan. Cuba lagi.');
 return data.record as Assessment;
}
export default function InlineAssessment({students,records,year,classId,subject,subjectName,type,term,skills,search,onBusy,onIdle,onSaved,onSuccess,onError}:Props){
 const actualTerm=type==='uasa'?'akhir':term;
 const saved=useMemo(()=>new Map(records.filter(r=>r.assessment_type===type&&r.term===actualTerm).map(r=>[r.student_id,r])),[records,type,actualTerm]);
 const [pending,SET]=useState<Record<string,Assessment>>({});
 const [saving,SAVING]=useState(false);
 const changed=Object.keys(pending);
 const filtered=students.filter(s=>s.full_name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
 function change(student:Pupil,fn:(old:Assessment)=>Assessment){
  if(saving)return;
  SET(previous=>{
   const base=previous[student.id]||newDraft(student.id,saved.get(student.id),actualTerm,type);
   return {...previous,[student.id]:fn(base)};
  });
 }
 async function saveIds(ids:string[]){
  if(saving)return;
  const batch=ids.filter(id=>pending[id]).map(id=>({id,pupil:students.find(s=>s.id===id),draft:pending[id]}));
  if(!batch.length){onError('Tiada perubahan untuk disimpan.');return}
  SAVING(true);
  onBusy(batch.length>1?'Sedang menyimpan '+batch.length+' rekod murid...':'Sedang menyimpan maklumat murid...');
  const failures:string[]=[];
  let success=0,position=0;
  async function worker(){
   while(position<batch.length){
    const item=batch[position++];
    try{
     const record=await saveToServer({...item.draft,year,classId,studentId:item.id,subject,type,term:actualTerm});
     success++;
     onSaved(record);
     SET(old=>{
      if(old[item.id]!==item.draft)return old;
      const next={...old};delete next[item.id];return next;
     });
    }catch(err){
     failures.push((item.pupil?.full_name||'Murid')+': '+(err instanceof Error?err.message:'Gagal simpan'));
    }
   }
  }
  try{
   await Promise.all(Array.from({length:Math.min(4,batch.length)},()=>worker()));
   if(failures.length)onError(success+' rekod berjaya disimpan. '+failures.length+' rekod gagal dan perubahan masih kekal. '+failures.slice(0,2).join(' | '));
   else onSuccess(batch.length===1?'Maklumat murid berjaya disimpan.':batch.length+' rekod murid berjaya disimpan.');
  }finally{
   SAVING(false);onIdle();
  }
 }
 const skillLabel=(skill:string)=>subject==='BM'?(skill==='Mendengar dan Bertutur'?'Mendengar & Bertutur':skill):skill;
 const gradeLabel=(score:number|null)=>score===null?'Belum diisi':('Gred '+gradeFor(score));
 const toolbar=<div className="inlineToolbar"><div><strong>Pengisian Terus · {subjectName}</strong><small>{type==='pbd'?'Tekan terus nombor TP. Tidak perlu buka nama murid.':'Isi markah UASA terus, gred dijana automatik.'}</small></div><button type="button" className="inlineSaveAll" disabled={saving||!changed.length} onClick={()=>saveIds(changed)}>✓ Simpan Semua ({changed.length})</button></div>;
 return <div className="inlineAssessment">
  {toolbar}
  {filtered.length===0?<div className="empty">Tiada murid ditemui.</div>:
   <div className="inlinePupilList">
    {filtered.map((student,index)=>{
     const previous=saved.get(student.id);
     const draft=pending[student.id]||newDraft(student.id,previous,actualTerm,type);
     const dirty=!!pending[student.id];
     const number=students.findIndex(s=>s.id===student.id)+1;
     return <article className={'inlinePupil'+(dirty?' inlinePupilDirty':'')} key={student.id}>
      <div className="inlinePupilHead">
       <div className="inlinePupilIdentity"><span className="inlinePupilNumber">{number}</span><strong>{student.full_name}</strong></div>
       <span className={'inlinePupilStatus'+(dirty?' editing':previous?.status==='lengkap'?' completed':'')}>{dirty?'Belum simpan':previous?.status==='lengkap'?'✓ Lengkap':previous?'Draf':'Belum isi'}</span>
      </div>
      {type==='pbd'?<div className="inlinePupilBody">
       {skills.length>0&&<div className="inlineQuick">
        <div className="inlineQuickIntro"><strong>⚡ Satu TP untuk semua kemahiran</strong><small>Satu klik isi semua kemahiran + TP keseluruhan. Boleh ubah setiap kemahiran selepas itu.</small></div>
        <div className="inlineQuickButtons">{TP.map(n=><button type="button" key={n} disabled={saving} className={'inlineNumber'+(draft.tp===n&&skills.every(k=>draft.skills[k]===n)?' selected':'')} onClick={()=>change(student,d=>({...d,tp:n,skills:{...d.skills,...Object.fromEntries(skills.map(k=>[k,n]))}}))}>{n}</button>)}</div>
       </div>}
       {skills.length>0&&<div className="inlineSkills">
        {skills.map(skill=><div className="inlineSkill" key={skill}>
         <label>{skillLabel(skill)}</label>
         <div className="inlineChoices">{[...TP,'TD'].map(n=><button type="button" key={n} disabled={saving} aria-pressed={draft.skills[skill]===n} className={'inlineNumber'+(draft.skills[skill]===n?' selected':'')} onClick={()=>change(student,d=>({...d,skills:{...d.skills,[skill]:n as number|'TD'}}))}>{n}</button>)}</div>
        </div>)}
       </div>}
       <div className="inlineOverall"><label>TP Keseluruhan</label><div className="inlineChoices">{TP.map(n=><button type="button" key={n} disabled={saving} aria-pressed={draft.tp===n} className={'inlineNumber'+(draft.tp===n?' selected':'')} onClick={()=>change(student,d=>({...d,tp:n}))}>{n}</button>)}</div></div>
       <div className="inlineDetails">
        <div className="inlineDetail"><label>Ulasan Guru</label><div className="inlinePills">{COMMENTS.map(val=><button type="button" key={val} disabled={saving} aria-pressed={draft.remarks===val} className={'inlinePill'+(draft.remarks===val?' selected':'')} onClick={()=>change(student,d=>({...d,remarks:val}))}>{val}</button>)}</div></div>
        <div className="inlineDetail"><label>Usaha Murid</label><div className="inlinePills">{EFFORTS.map(val=><button type="button" key={val} disabled={saving} aria-pressed={draft.effort===val} className={'inlinePill'+(draft.effort===val?' selected':'')} onClick={()=>change(student,d=>({...d,effort:val}))}>{val}</button>)}</div></div>
       </div>
       <details className="inlineIntervention" open={!!draft.intervention?undefined:undefined}><summary>Intervensi (pilihan)</summary><textarea rows={2} value={draft.intervention} disabled={saving} placeholder="Catatan intervensi jika perlu" onChange={e=>change(student,d=>({...d,intervention:e.target.value}))}/></details>
      </div>:<div className="inlineExam"><label htmlFor={'mark-'+student.id}>Markah UASA (0–100)</label><input id={'mark-'+student.id} type="number" inputMode="numeric" min={0} max={100} step={1} disabled={saving} value={draft.score??''} placeholder="Markah" onChange={e=>change(student,d=>({...d,score:e.target.value===''?null:Number(e.target.value)}))}/><span className="inlineGrade">{gradeLabel(draft.score)}</span></div>}
      <div className="inlinePupilFooter"><small>{dirty?'● Perubahan belum disimpan':previous?.status==='lengkap'?'✓ Rekod tersimpan':'Lengkapkan maklumat kemudian simpan'}</small><button type="button" className="inlineSaveOne" disabled={!dirty||saving} onClick={()=>saveIds([student.id])}>Simpan Murid Ini</button></div>
     </article>
    })}
   </div>}
  <div className="inlineBottomBar"><span>{filtered.length} murid dipaparkan · {changed.length} belum disimpan</span><button type="button" className="inlineSaveAll" disabled={saving||!changed.length} onClick={()=>saveIds(changed)}>✓ Simpan Semua ({changed.length})</button></div>
 </div>;
}
