import {PDFDocument} from 'pdf-lib';
import {makeReportPdf} from '../lib/report-pdf.ts';

function fixture(type){
 const groups=Array.from({length:18},(_,i)=>({id:'kelas-'+i,name:'4 IBNU '+String(i+1),level:4}));
 const students=groups.flatMap((c,i)=>Array.from({length:6},(_,j)=>({
  id:'student-'+i+'-'+j,name:'AHMAD BIN MOHAMAD '+i+' '+j,
  classId:c.id,className:c.name,level:c.level,
  status:'lengkap',tp:type==='pbd'?3:null,score:type==='uasa'?72:null,
  grade:type==='uasa'?'B':null,
  skills:type==='pbd'?{Listening:3,Speaking:3,Reading:3,Writing:3}:{},
  remarks:'CEMERLANG',effort:'TINGGI',intervention:''
 })));
 const mean={total:students.length,complete:students.length,draft:0,missing:0,excluded:0,completion:100,meanTp:type==='pbd'?3:null,meanScore:type==='uasa'?72:null};
 return {
  meta:{year:2026,type,term:'akhir',scope:'school',level:null,subjectId:'BI',subjectName:'Bahasa Inggeris',title:type.toUpperCase()+' - Bahasa Inggeris - SEKOLAH',generatedAt:new Date().toISOString(),classCount:groups.length,classNames:groups.map(c=>c.name)},
  summary:mean,
  tpDistribution:['TP1','TP2','TP3','TP4','TP5','TP6'].map(x=>({label:x,value:x==='TP3'?students.length:0})),
  gradeDistribution:['A','B','C','D','E','F'].map(x=>({label:x,value:x==='B'?students.length:0})),
  skillDistribution:type==='pbd'?['Listening','Speaking','Reading','Writing'].map(name=>({name,counts:['TP1','TP2','TP3','TP4','TP5','TP6','TD'].map(label=>({label,value:label==='TP3'?students.length:0}))})):[],
  perClass:groups.map(c=>({id:c.id,name:c.name,level:c.level,summary:{...mean,total:6,complete:6}})),
  attention:[],rows:students
 };
}
for(const type of ['pbd','uasa']){
 const result=await makeReportPdf(fixture(type));
 const pdf=await PDFDocument.load(result);
 const pages=pdf.getPages();
 if(pages.length<6)throw Error(type+': too few pages '+pages.length);
 for(const [i,page] of pages.entries()){
  const {width,height}=page.getSize();
  if(width<840||width>843||height<594||height>597)throw Error('Non A4-landscape page '+i);
 }
 if(result.byteLength<5000)throw Error('PDF abnormally small');
 console.log('PASS '+type.toUpperCase()+': '+pages.length+' A4 landscape pages, '+result.byteLength+' bytes');
}
