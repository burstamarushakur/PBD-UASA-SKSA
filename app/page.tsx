'use client';
import {useEffect,useState} from 'react';
import {ProcessOverlay,SaveCelebration} from './feedback';
type Teacher={id:string;full_name:string;role:'admin'|'guru'};
type Klass={id:string;name:string;year_level:number};
type Subject={id:string;name:string;short_name:string;min_year:number;max_year:number;skills:string[]};
type Student={id:string;full_name:string};
type RecordT={id:string;student_id:string;term:string;assessment_type:string;tp:number|null;score:number|null;grade:string|null;skills:Record<string,number|'TD'>;remarks:string;intervention:string;effort:string;status:string};
const logo='https://i.postimg.cc/3RF9M05N/Logo-SKSA.png';
async function call(path:string,body?:unknown){
 let r:Response;
 try{r=await fetch(`/api/${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store'});}
 catch{throw Error('Sambungan internet / Vercel gagal. Sila cuba semula.')}
 const raw=await r.text();let v:any;
 try{v=JSON.parse(raw)}catch{throw Error(`Pelayan tidak memulangkan JSON (${r.status}). Semak deployment dan fungsi API Vercel.`)}
 if(!r.ok)throw Error(v.error||v.message||`Ralat pelayan (${r.status})`);
 return v;
}
const years=[2026,2027,2028];
const BI_SKILLS=['Listening','Speaking','Reading','Writing'] as const;
// IDMe PBD Bahasa Melayu: tiga kemahiran sahaja untuk Tahun 1–6.
const BM_SKILLS=['Mendengar dan Bertutur','Membaca','Menulis'] as const;
const TP_CHOICES=[1,2,3,4,5,6] as const;
const ULASAN=['CEMERLANG','SEDERHANA','LEMAH'] as const;
const USAHA=['SANGAT TINGGI','TINGGI','SEDERHANA','RENDAH'] as const;
const EMPTY=(student_id:string,term:string,type:string):RecordT=>({id:'',student_id,term,assessment_type:type,tp:null,score:null,grade:null,skills:{},remarks:'',intervention:'',effort:'',status:'draf'});
export default function Home(){
 const [teacher,T]=useState<Teacher|null>(null),[health,H]=useState<{ok:boolean;missing?:string[];message:string}|null>(null),[ic,IC]=useState(''),[year,Y]=useState(2026),[overview,O]=useState<any>(null),[klass,K]=useState(''),[subject,S]=useState('BI'),[type,TYPE]=useState('pbd'),[term,TERM]=useState('akhir');
 const [students,ST]=useState<Student[]>([]),[records,R]=useState<RecordT[]>([]),[selected,SEL]=useState<Student|null>(null),[draft,D]=useState<RecordT|null>(null),[tab,TAB]=useState<'pentaksiran'|'admin'>('pentaksiran'),[busy,B]=useState(false),[loadingText,L]=useState('Sedang memproses data...'),[celebrate,CELEBRATE]=useState(false),[message,M]=useState(''),[search,Q]=useState(''),[adminTeacher,AT]=useState(''),[adminClass,AC]=useState(''),[adminSubject,AS]=useState('BI');
 const showError=(e:unknown)=>M(e instanceof Error?e.message:'Ralat tidak diketahui');
 useEffect(()=>{if(!celebrate)return;const timer=window.setTimeout(()=>CELEBRATE(false),3100);return ()=>window.clearTimeout(timer)},[celebrate]);
 useEffect(()=>{
 call('me').then(x=>T(x.teacher)).catch(()=>{});
 fetch('/api/health',{cache:'no-store'}).then(r=>r.json()).then(H).catch(e=>H({ok:false,message:e instanceof Error?e.message:'Ralat sambungan'}));
},[]);
 useEffect(()=>{if(!teacher)return;O(null);K('');ST([]);call(`overview?year=${year}`).then(O).catch(showError)},[teacher,year]);
 useEffect(()=>{if(!klass||!subject||!teacher){ST([]);return}L('Sedang memuatkan data murid...');B(true);call(`students?year=${year}&classId=${klass}&subject=${encodeURIComponent(subject)}`).then(x=>{ST(x.students);R(x.records)}).catch(showError).finally(()=>B(false))},[teacher,year,klass,subject]);
 const currentClass:Klass|undefined=overview?.classes.find((c:Klass)=>c.id===klass);
 const subjects:Subject[]=overview?.subjects||[];
 const filteredSubjects=subjects.filter(s=>!currentClass||currentClass.year_level>=s.min_year&&currentClass.year_level<=s.max_year);
 const allowedSubjects=teacher?.role==='admin'?filteredSubjects:filteredSubjects.filter(s=>overview?.assignments.some((a:any)=>a.class_id===klass&&a.subject_id===s.id));
 const currentSubject:Subject|undefined=subjects.find(s=>s.id===subject);
 const entrySkills=subject==='BI'?BI_SKILLS:subject==='BM'?BM_SKILLS:[];
 const tileSkills=subject==='BM'?BM_SKILLS:subject==='BI'?BI_SKILLS:(currentSubject?.skills||[]);
 const getRecord=(id:string)=>records.find(r=>r.student_id===id&&r.assessment_type===type&&r.term===(type==='uasa'?'akhir':term));
 const open=(s:Student)=>{
  const existing=getRecord(s.id);
  const skills=existing?.skills||{};
  const cleanSkills=entrySkills.length?Object.fromEntries(entrySkills.filter(k=>skills[k]!==undefined).map(k=>[k,skills[k]])):skills;
  SEL(s);
  D({...EMPTY(s.id,type,type==='uasa'?'akhir':term),...existing,skills:{...cleanSkills}});
 };
 const applyAllSkills=(tp:number)=>{
  if(!draft)return;
  D({...draft,tp,skills:Object.fromEntries(entrySkills.map(skill=>[skill,tp]))});
 };
 async function save(){if(!selected||!draft)return;L('Sedang menyimpan maklumat murid...');B(true);M('');try{const v=await call('save',{...draft,year,classId:klass,studentId:selected.id,subject,type,term:type==='uasa'?'akhir':term});R(old=>[...old.filter(x=>!(x.student_id===selected.id&&x.assessment_type===type&&x.term===(type==='uasa'?'akhir':term))),v.record]);SEL(null);D(null);M('Maklumat berjaya disimpan.');CELEBRATE(true)}catch(e){showError(e)}finally{B(false)}}
 async function login(e:React.FormEvent){e.preventDefault();L('Sedang log masuk...');B(true);M('');try{await call('login',{ic});const v=await call('me');T(v.teacher);IC('')}catch(e){showError(e)}finally{B(false)}}
 async function logout(){await call('logout',{});T(null);O(null);K('');ST([]);M('')}
 async function syncNow(){L('Sedang menyegerakkan data kelas dan murid...');B(true);M('');try{const v=await call('sync',{});M('Data Utama disegerakkan: '+(v.updated?.student_enrolments||0)+' enrolmen diperiksa.');O(await call(`overview?year=${year}`));if(klass&&subject){const updated=await call(`students?year=${year}&classId=${klass}&subject=${encodeURIComponent(subject)}`);ST(updated.students);R(updated.records)}}catch(e){showError(e)}finally{B(false)}}
 async function updateAccess(id:string,role:'admin'|'guru',enabled:boolean){L('Sedang mengemas kini akses guru...');B(true);try{await call('access',{teacherId:id,role,enabled});O(await call(`overview?year=${year}`));M('Akses guru dikemaskini')}catch(e){showError(e)}finally{B(false)}}
 async function assign(remove:boolean){if(!adminTeacher||!adminClass||!adminSubject)return M('Pilih guru, kelas dan subjek dahulu');L(remove?'Sedang membuang agihan subjek...':'Sedang menyimpan agihan subjek...');B(true);try{await call('assign',{teacherId:adminTeacher,classId:adminClass,subject:adminSubject,year,remove});O(await call(`overview?year=${year}`));M(remove?'Agihan dibuang':'Agihan berjaya disimpan')}catch(e){showError(e)}finally{B(false)}}
 const countComplete=students.filter(s=>getRecord(s.id)?.status==='lengkap').length;
 if(!teacher)return <><div className="loginWrap"><form onSubmit={login} className="loginCard"><img src={logo} alt="Logo SKSA"/><div className="eyebrow">SISTEM AKADEMIK SEKOLAH</div><h1>Portal PBD & UASA</h1><p>Sekolah Kebangsaan SKSA</p><label>No. Kad Pengenalan Guru</label><input required inputMode="numeric" value={ic} maxLength={14} onChange={e=>IC(e.target.value)} placeholder="12 digit tanpa sengkang"/><button disabled={busy} className="primary">{busy?'Sedang menyemak...':'Log Masuk'}</button>
 {health&&!health.ok&&<div className="error" role="alert"><b>Sambungan belum sedia:</b> {health.message}{!!health.missing?.length&&<p>Sila tetapkan di Vercel: {health.missing.join(', ')}</p>}</div>}
 {message&&<p className="error" role="alert">{message}</p>}<small>Masuk menggunakan IC berdaftar dan telah diaktifkan oleh admin.</small></form></div>{busy&&<ProcessOverlay text={loadingText}/>}</>;
 return <><div className="app"><aside className="sidebar"><div className="brand"><img src={logo} alt="Logo Sekolah"/><div><strong>SKSA</strong><span>PORTAL PBD & UASA</span></div></div><div className="sideLinks"><button className={tab==='pentaksiran'?'active':''} onClick={()=>TAB('pentaksiran')}>▦  Pentaksiran Murid</button>{teacher.role==='admin'&&<button className={tab==='admin'?'active':''} onClick={()=>TAB('admin')}>⚙  Pengurusan Admin</button>}</div><div className="sideBottom"><div><b>{teacher.full_name}</b><small>{teacher.role==='admin'?'Pentadbir':'Guru Mata Pelajaran'}</small></div><button onClick={logout}>Log Keluar ↗</button></div></aside><main className="content"><header><div><div className="eyebrow">PENGURUSAN AKADEMIK</div><h1>{tab==='admin'?'Pengurusan Admin':'Pentaksiran PBD & UASA'}</h1><p>Data murid dan kelas: Salinan Supabase SKSA dalam Neon</p></div><div className="topActions"><select value={year} onChange={e=>Y(Number(e.target.value))}>{years.map(y=><option key={y}>{y}</option>)}</select><span className="pill">● {teacher.role==='admin'?'ADMIN':'GURU'}</span></div></header>{message&&<div className="notice" onClick={()=>M('')}>{message} <span>✕</span></div>}
 {tab==='pentaksiran'?<><section className="stats"><div className="stat"><span>Kelas Dipaparkan</span><strong>{overview?.classes.length??'—'}</strong><small>Tahun 1 hingga 6</small></div><div className="stat"><span>Jumlah Murid Kelas</span><strong>{klass?students.length:'—'}</strong><small>Mengikut kelas dipilih</small></div><div className="stat"><span>Pentaksiran Lengkap</span><strong>{klass?countComplete:'—'}</strong><small>{klass?`${students.length?Math.round(countComplete/students.length*100):0}% telah lengkap`:'Pilih kelas dahulu'}</small></div></section><section className="panel"><h2>Pilih Kelas dan Subjek</h2><div className="filters"><div><label>Kelas</label><select value={klass} onChange={e=>{K(e.target.value);S('')}}><option value="">Pilih kelas</option>{overview?.classes.map((c:Klass)=><option value={c.id} key={c.id}>{c.name}</option>)}</select></div><div><label>Mata Pelajaran</label><select value={subject} onChange={e=>S(e.target.value)} disabled={!klass}><option value="">Pilih subjek</option>{allowedSubjects.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></div><div><label>Jenis Pentaksiran</label><select value={type} onChange={e=>TYPE(e.target.value)}><option value="pbd">PBD</option>{currentClass&&currentClass.year_level>=4&&<option value="uasa">UASA</option>}</select></div><div><label>Penggal</label><select disabled={type==='uasa'} value={type==='uasa'?'akhir':term} onChange={e=>TERM(e.target.value)}><option value="pertengahan">Pertengahan Tahun</option><option value="akhir">Akhir Tahun</option></select></div></div></section><section className="panel"><div className="sectionHead"><div><h2>Senarai Murid</h2><p>{currentClass?.name||'Pilih kelas untuk paparkan murid'} · {currentSubject?.name||'Pilih mata pelajaran'}</p></div><input placeholder="Cari nama murid..." value={search} onChange={e=>Q(e.target.value)} /></div>{busy?<p>Memuatkan data...</p>:!klass||!subject?<div className="empty">Pilih kelas dan mata pelajaran dahulu untuk melihat senarai murid.</div>:<div className="studentGrid">{students.filter(s=>s.full_name.toLowerCase().includes(search.toLowerCase())).map((s,i)=>{const record=getRecord(s.id);return <button className="student" key={s.id} onClick={()=>open(s)}><div className="studentTop"><span>{i+1}</span><span className={'indicator '+(record?.status==='lengkap'?'done':'')}>{record?.status==='lengkap'?'✓ Lengkap':record?'Draf':'Belum isi'}</span></div><strong>{s.full_name}</strong><div className="indicators">{type==='pbd'?<><span className={record?.tp?'filled':''}>TP {record?.tp||'–'}</span>{tileSkills.slice(0,4).map(skill=><span key={skill} title={skill} className={record?.skills?.[skill]!==undefined?'filled':''}>{subject==='BM'?({'Mendengar dan Bertutur':'D&T','Membaca':'BACA','Menulis':'TULIS'} as Record<string,string>)[skill]:skill.slice(0,2).toUpperCase()}</span>)}</>:<span className={record?.score!==null&&record?.score!==undefined?'filled':''}>Markah: {record?.score??'–'} {record?.grade||''}</span>}</div></button>})}</div>}</section></>:<><section className="panel"><div className="sectionHead"><h2>Aktifkan / Urus Guru</h2><button disabled={busy} onClick={syncNow}>{busy?'Sedang sync...':'↻ Segerakkan Data Utama'}</button></div><p className="help">Hanya guru aktif boleh masuk. Semua guru lain belum diberi akses sehingga admin aktifkan.</p><div className="teacherRows">{overview?.teachers.map((t:any)=>{const a=overview.access.find((x:any)=>x.teacher_id===t.id);return <div className="teacherRow" key={t.id}><b>{t.full_name}</b><select value={a?.role||'guru'} onChange={e=>updateAccess(t.id,e.target.value as any,!!a?.enabled)}><option value="guru">Guru</option><option value="admin">Admin</option></select><label><input type="checkbox" checked={!!a?.enabled} onChange={e=>updateAccess(t.id,a?.role||'guru',e.target.checked)}/> Akses</label></div>})}</div></section><section className="panel"><h2>Agihan Subjek Mengikut Kelas</h2><div className="filters"><div><label>Guru</label><select value={adminTeacher} onChange={e=>AT(e.target.value)}><option value="">Pilih guru</option>{overview?.teachers.map((t:any)=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select></div><div><label>Kelas</label><select value={adminClass} onChange={e=>AC(e.target.value)}><option value="">Pilih kelas</option>{overview?.classes.map((c:Klass)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div><label>Subjek</label><select value={adminSubject} onChange={e=>AS(e.target.value)}>{subjects.filter(s=>{const c=overview?.classes.find((x:Klass)=>x.id===adminClass);return !c||c.year_level>=s.min_year&&c.year_level<=s.max_year}).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div></div><div className="buttons"><button className="primary" disabled={busy} onClick={()=>assign(false)}>+ Simpan Agihan</button><button disabled={busy} onClick={()=>assign(true)}>Buang Agihan</button></div><h3>Agihan Sedia Ada</h3><div className="assignments">{overview?.assignments.map((a:any,i:number)=><div key={i}>{overview.teachers?.find((t:any)=>t.id===a.teacher_id)?.full_name||'Guru'} · {overview.classes.find((c:Klass)=>c.id===a.class_id)?.name||'Kelas'} · {subjects.find(s=>s.id===a.subject_id)?.name}</div>)}</div></section></>}
 </main>{selected&&draft&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)SEL(null)}}><div className="modal"><div className="modalHead"><div><small>{currentClass?.name} · {currentSubject?.name}</small><h2>{selected.full_name}</h2></div><button className="close" onClick={()=>SEL(null)}>✕</button></div><div className="modalBody">
  <div className="choice">
    <span>{type.toUpperCase()} · {type==='uasa'?'Akhir Tahun':term==='akhir'?'Akhir Tahun':'Pertengahan Tahun'}</span>
    <span>{year}</span>
  </div>
  {type==='pbd'?<>
    {(subject==='BI'||subject==='BM')&&<>
      <div className="quickTp">
        <div className="quickTpTitle">
          <strong><span aria-hidden="true">⚡ </span>Satu TP untuk semua kemahiran</strong>
          <small>Pilih sekali untuk isi semua {entrySkills.length} kemahiran. Jika tahap berbeza, ubah kemahiran tertentu di bawah.</small>
        </div>
        <div className="tpGrid">
          {TP_CHOICES.map(n=><button type="button" key={n} className={entrySkills.every(k=>draft.skills?.[k]===n)?'chosen':''} onClick={()=>applyAllSkills(n)}>TP {n}</button>)}
        </div>
      </div>
      <h3 className="skillsTitle">{subject==='BM'?'KEMAHIRAN BAHASA MELAYU':'Kemahiran Bahasa Inggeris'}</h3>
      <div className="skillsList">
       {entrySkills.map(skill=><div className={'skillRow'+(subject==='BM'?' bmSkillRow':'')} key={skill}>
         <label htmlFor={subject==='BI'?'skill-'+skill:undefined}>{subject==='BM'?'KEMAHIRAN '+(skill==='Mendengar dan Bertutur'?'MENDENGAR & BERTUTUR':skill.toUpperCase()):skill.toUpperCase()}</label>
         {subject==='BM'?
           <div className="bmSkillOptions" role="radiogroup" aria-label={'Kemahiran '+skill}>
             {TP_CHOICES.map(n=><label key={n} className={'bmRadio'+(draft.skills?.[skill]===n?' checked':'')}>
               <input type="radio" name={'bm-'+skill} checked={draft.skills?.[skill]===n} onChange={()=>D({...draft,skills:{...draft.skills,[skill]:n}})}/>TP{n}
             </label>)}
             <label className={'bmRadio'+(draft.skills?.[skill]==='TD'?' checked':'')}>
               <input type="radio" name={'bm-'+skill} checked={draft.skills?.[skill]==='TD'} onChange={()=>D({...draft,skills:{...draft.skills,[skill]:'TD'}})}/>TD
             </label>
           </div>
         :
           <select id={'skill-'+skill} value={draft.skills?.[skill]??''} onChange={e=>{const next={...draft.skills};if(e.target.value==='')delete next[skill];else next[skill]=e.target.value==='TD'?'TD':Number(e.target.value);D({...draft,skills:next})}}>
             <option value="">Pilih TP</option>
             {TP_CHOICES.map(n=><option key={n} value={n}>TP {n}</option>)}
             <option value="TD">TD — Tidak Ditaksir</option>
           </select>}
       </div>)}
      </div>
    </>}
    <label>Tahap Penguasaan Keseluruhan (TP) *</label>
    <div className="tpGrid overallTp">
      {TP_CHOICES.map(n=><button type="button" key={n} className={draft.tp===n?'chosen':''} onClick={()=>D({...draft,tp:n})}>TP {n}</button>)}
    </div>
    <label>Ulasan Guru *</label>
    <div className="choiceButtons">
      {ULASAN.map(option=><button type="button" key={option} className={draft.remarks===option?'chosen':''} onClick={()=>D({...draft,remarks:option})}>{option}</button>)}
    </div>
    <label>Usaha Murid *</label>
    <div className="choiceButtons">
      {USAHA.map(option=><button type="button" key={option} className={draft.effort===option?'chosen':''} onClick={()=>D({...draft,effort:option})}>{option}</button>)}
    </div>
    <label>Intervensi (jika perlu)</label>
    <textarea rows={2} value={draft.intervention} onChange={e=>D({...draft,intervention:e.target.value})} placeholder="Pilihan — isi hanya jika perlu"/>
    <p className="autoHelp">Status pentaksiran dikira automatik selepas Simpan; tak perlu pilih status.</p>
  </>:<>
    <label>Markah UASA (0–100) *</label>
    <input type="number" min="0" max="100" step="1" value={draft.score??''} onChange={e=>D({...draft,score:e.target.value===''?null:Number(e.target.value)})}/>
    <div className="grade">Gred automatik: <strong>{draft.score===null?'—':draft.score>=82?'A':draft.score>=66?'B':draft.score>=50?'C':draft.score>=35?'D':draft.score>=20?'E':'F'}</strong></div>
    <p className="autoHelp">Isi markah sahaja. Gred dan status dijana automatik.</p>
  </>}
 </div><footer><button onClick={()=>SEL(null)}>Batal</button><button className="primary" disabled={busy} onClick={save}>{busy?'Menyimpan...':'Simpan Maklumat'}</button></footer></div></div>}</div>{busy&&<ProcessOverlay text={loadingText}/>}{celebrate&&!busy&&<SaveCelebration onDismiss={()=>CELEBRATE(false)}/>}</>
}
