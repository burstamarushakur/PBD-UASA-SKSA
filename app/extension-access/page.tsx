'use client';
import {useEffect,useState} from 'react';

type Teacher={id:string;full_name:string;active:boolean};
type Access={teacher_id:string;enabled:boolean};
const portal='/';

export default function ExtensionAccessPage(){
 const [teachers,setTeachers]=useState<Teacher[]>([]);
 const [access,setAccess]=useState<Access[]>([]);
 const [selected,setSelected]=useState('');
 const [code,setCode]=useState('');
 const [expires,setExpires]=useState('');
 const [state,setState]=useState('Sedang menyemak akses admin…');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{void(async()=>{
  try{
   const r=await fetch('/api/overview?year=2026',{cache:'no-store'});
   if(!r.ok)throw Error('Sila log masuk sebagai admin melalui Portal PBD-UASA dahulu.');
   const j=await r.json();
   if(j.teacher?.role!=='admin')throw Error('Halaman ini hanya untuk admin.');
   const allowed=(j.teachers||[]).filter((t:Teacher)=>(j.access||[]).some((a:Access)=>a.teacher_id===t.id&&a.enabled));
   setTeachers(allowed);setAccess(j.access||[]);setSelected(allowed[0]?.id||'');
   setState(allowed.length?'Pilih guru yang hendak diberikan akses extension.':'Tiada guru aktif. Aktifkan akses guru dalam Panel Admin dahulu.');
  }catch(e){setState(e instanceof Error?e.message:'Gagal membaca kebenaran admin.');}
 })()},[]);
 async function generate(){
  if(!selected)return;setBusy(true);setCode('');setState('Sedang menjana kod…');
  try{
   if(!access.some(a=>a.teacher_id===selected&&a.enabled))throw Error('Akses guru belum aktif.');
   const r=await fetch('/api/extension-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({teacherId:selected})});
   const j=await r.json();if(!r.ok)throw Error(j.error||'Gagal menjana kod.');
   setCode(j.code);setExpires(new Date(j.expiresAt).toLocaleString('ms-MY'));
   setState('Kod berjaya dijana. Serahkan secara peribadi kepada guru berkenaan.');
  }catch(e){setState(e instanceof Error?e.message:'Gagal menjana kod.');}
  finally{setBusy(false)}
 }
 return <main style={{maxWidth:720,margin:'40px auto',padding:24,fontFamily:'system-ui,Arial,sans-serif',lineHeight:1.6}}>
  <a href={portal}>← Portal PBD-UASA SKSA</a>
  <h1>Kod Akses Chrome Extension SKSA</h1>
  <p>Halaman pentadbir sahaja. Guru tidak perlu membuka webapp atau log masuk apabila menggunakan extension selepas pengaktifan.</p>
  <section style={{padding:20,border:'1px solid #cbd5e1',borderRadius:16,background:'#f8fafc'}}>
   <label htmlFor="teacher"><strong>Guru penerima</strong></label>
   <select id="teacher" value={selected} onChange={e=>{setSelected(e.target.value);setCode('')}} disabled={busy||!teachers.length} style={{display:'block',width:'100%',padding:12,margin:'10px 0 16px'}}>
    {teachers.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}
   </select>
   <button type="button" onClick={generate} disabled={busy||!selected} style={{padding:'12px 18px',background:'#0f766e',color:'white',border:0,borderRadius:9,cursor:'pointer'}}>
    {busy?'Sedang menjana…':'Jana Kod Akses Guru'}
   </button>
   <p role="status">{state}</p>
   {code&&<div style={{marginTop:14}}>
    <label htmlFor="activation-code"><strong>Kod pengaktifan (sah hingga {expires})</strong></label>
    <textarea id="activation-code" value={code} readOnly rows={5} style={{display:'block',width:'100%',padding:10,overflowWrap:'anywhere'}}/>
    <button type="button" onClick={()=>void navigator.clipboard.writeText(code)} style={{marginTop:8,padding:10}}>Salin Kod</button>
   </div>}
  </section>
  <p><strong>Keselamatan:</strong> Kod ini memberi akses baca sahaja kepada kelas/subjek yang ditetapkan untuk guru tersebut selama 90 hari. Jangan kongsi di kumpulan terbuka. Menyahaktifkan akses guru dalam panel admin akan membatalkan kodnya.</p>
 </main>;
}
