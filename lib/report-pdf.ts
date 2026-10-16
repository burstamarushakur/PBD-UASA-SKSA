import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import type {ReportBundle} from './reporting';

const NAVY=rgb(.09,.20,.36),BLUE=rgb(.15,.39,.68),LIGHT=rgb(.94,.97,1),GREY=rgb(.38,.46,.56),BORDER=rgb(.83,.87,.91),WHITE=rgb(1,1,1);
const WIDTH=841.89,HEIGHT=595.28;
const asText=(value:unknown)=>String(value??'').replace(/[\x00-\x1f\x7f]/g,' ').replace(/[\u{1F000}-\u{1FFFF}]/gu,'');
const fmt=(n:number|null)=>n===null?'-':String(n);
const dateTime=(iso:string)=>new Date(iso).toLocaleString('ms-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'});
export async function makeReportPdf(data:ReportBundle):Promise<Uint8Array>{
 const pdf=await PDFDocument.create();
 const regular=await pdf.embedFont(StandardFonts.Helvetica);
 const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 pdf.setTitle('SKSA - '+data.meta.title);
 pdf.setAuthor('Portal PBD & UASA SKSA');
 pdf.setSubject('Laporan pentaksiran - data sebenar portal');
 const pages:ReturnType<typeof pdf.addPage>[]=[];
 const addPage=()=>{const p=pdf.addPage([WIDTH,HEIGHT]);pages.push(p);return p};
 const fit=(s:unknown,maxWidth:number,size=9,strong=false)=>{
  const font=strong?bold:regular;let text=asText(s);
  if(font.widthOfTextAtSize(text,size)<=maxWidth)return text;
  while(text.length>0&&font.widthOfTextAtSize(text+'...',size)>maxWidth)text=text.slice(0,-1);
  return text+'...';
 };
 const text=(page:ReturnType<typeof pdf.addPage>,value:unknown,x:number,y:number,size=9,color=GREY,strong=false,maxWidth?:number)=>{
  const font=strong?bold:regular;
  page.drawText(maxWidth?fit(value,maxWidth,size,strong):asText(value),{x,y,size,font,color});
 };
 const base=(page:ReturnType<typeof pdf.addPage>,label:string)=>{
  page.drawRectangle({x:0,y:HEIGHT-68,width:WIDTH,height:68,color:NAVY});
  text(page,'SKSA  |  PORTAL PBD & UASA',38,HEIGHT-29,14,WHITE,true);
  text(page,label,38,HEIGHT-49,9,rgb(.78,.86,.97));
  page.drawLine({start:{x:38,y:41},end:{x:WIDTH-38,y:41},thickness:.6,color:BORDER});
  text(page,'Sumber: Data pentaksiran yang disimpan dalam Portal PBD & UASA SKSA',38,27,8,GREY);
 };
 const card=(page:ReturnType<typeof pdf.addPage>,x:number,y:number,w:number,heading:string,value:string,sub?:string)=>{
  page.drawRectangle({x,y,width:w,height:66,borderColor:BORDER,borderWidth:.8,color:LIGHT});
  text(page,heading,x+12,y+47,9,GREY,true);
  text(page,value,x+12,y+21,21,NAVY,true,w-20);
  if(sub)text(page,sub,x+65,y+24,8,GREY,false,w-75);
 };
 // 1. Dashboard summary.
 const first=addPage();base(first,data.meta.title);
 text(first,'LAPORAN ANALISIS '+data.meta.type.toUpperCase(),38,HEIGHT-101,19,NAVY,true);
 text(first,data.meta.subjectName+'  |  '+data.meta.year+'  |  '+(data.meta.scope==='school'?'Seluruh sekolah':data.meta.scope==='year'?'Tahun '+data.meta.level:data.meta.classNames.join(', ')),38,HEIGHT-125,11,GREY,false,WIDTH-76);
 text(first,(data.meta.type==='uasa'?'Akhir Tahun':data.meta.term==='akhir'?'Akhir Tahun':'Pertengahan Tahun')+'  |  '+dateTime(data.meta.generatedAt),38,HEIGHT-143,9,GREY);
 const s=data.summary;
 const cardY=337;const gap=9;const cw=(WIDTH-76-gap*3)/4;
 card(first,38,cardY,cw,'MURID BERDAFTAR',String(s.total));
 card(first,38+cw+gap,cardY,cw,'REKOD LENGKAP',String(s.complete));
 card(first,38+2*(cw+gap),cardY,cw,'KADAR LENGKAP',s.completion.toFixed(1)+'%');
 card(first,38+3*(cw+gap),cardY,cw,data.meta.type==='pbd'?'PURATA TP':'PURATA MARKAH',fmt(data.meta.type==='pbd'?s.meanTp:s.meanScore));
 text(first,data.meta.type==='pbd'?'Taburan Tahap Penguasaan (rekod lengkap sahaja)':'Taburan Gred UASA (rekod lengkap sahaja)',38,309,12,NAVY,true);
 const distribution=data.meta.type==='pbd'?data.tpDistribution:data.gradeDistribution;
 const max=Math.max(1,...distribution.map(x=>x.value));
 const x0=55,cy=108,chartHeight=157,barWidth=43,spacing=12;
 first.drawLine({start:{x:47,y:cy},end:{x:393,y:cy},thickness:1,color:BORDER});
 distribution.forEach((a,i)=>{const x=x0+i*(barWidth+spacing),h=(a.value/max)*chartHeight;
  first.drawRectangle({x,y:cy,width:barWidth,height:Math.max(1,h),color:BLUE});
  text(first,a.label,x+6,cy-17,9,NAVY,true);
  text(first,a.value,x+13,cy+h+7,9,NAVY,true);
 });
 text(first,'Status Pengisian',455,309,12,NAVY,true);
 const statuses=[['Lengkap',s.complete,BLUE],['Draf',s.draft,rgb(.95,.65,.26)],['Belum Isi',s.missing,rgb(.83,.36,.36)],['Tidak Berkenaan',s.excluded,rgb(.65,.69,.75)]] as const;
 statuses.forEach(([label,count,color],i)=>{
  const y=270-i*43;
  text(first,label,456,y,10,NAVY,true);text(first,count,752,y,10,NAVY,true);
  first.drawRectangle({x:456,y:y-16,width:306,height:9,color:LIGHT});
  if(s.total>0)first.drawRectangle({x:456,y:y-16,width:Math.max(0,306*count/s.total),height:9,color});
 });
 text(first,'Nota: Murid yang belum isi / draf tidak dimasukkan dalam taburan TP atau gred.',38,70,8,GREY);
 // 2. Subject skills and class-level comparison.
 const second=addPage();base(second,'Ringkasan mengikut kemahiran dan kelas');
 text(second,'ANALISIS TERPERINCI',38,HEIGHT-96,17,NAVY,true);
 let y=HEIGHT-125;
 if(data.meta.type==='pbd'&&data.skillDistribution.length){
  text(second,'Kemahiran - taburan TP1 hingga TP6 / TD (rekod lengkap)',38,y,11,NAVY,true);y-=23;
  const names=['TP1','TP2','TP3','TP4','TP5','TP6','TD'];
  const color=[rgb(.85,.35,.35),rgb(.95,.57,.29),rgb(.93,.77,.34),rgb(.44,.72,.76),rgb(.35,.59,.85),rgb(.28,.65,.48),rgb(.58,.62,.68)];
  data.skillDistribution.slice(0,7).forEach(d=>{
   const total=d.counts.reduce((a,c)=>a+c.value,0);
   text(second,d.name,42,y,9,NAVY,true,220);
   let x=268;const width=485;
   d.counts.forEach((e,i)=>{const w=total?width*e.value/total:0;if(w>.1)second.drawRectangle({x,y:y-3,width:w,height:12,color:color[i]});x+=w});
   text(second,String(total),766,y,8,GREY);
   y-=28;
  });
  text(second,names.join('    '),268,y+4,8,GREY);y-=25;
 }else{
  text(second,'Statistik mengikut kelas',38,y,11,NAVY,true);y-=20;
 }
 text(second,'PERBANDINGAN KELAS',38,y,11,NAVY,true);y-=22;
 const tableX=38,tw=766,rowH=19;
 second.drawRectangle({x:tableX,y:y-3,width:tw,height:22,color:LIGHT,borderColor:BORDER,borderWidth:.5});
 text(second,'Kelas',47,y+4,9,NAVY,true);
 text(second,'Murid',376,y+4,9,NAVY,true);
 text(second,'Lengkap',464,y+4,9,NAVY,true);
 text(second,'Kadar',559,y+4,9,NAVY,true);
 text(second,data.meta.type==='pbd'?'Purata TP':'Purata Markah',667,y+4,9,NAVY,true);
 y-=rowH+3;
 for(const c of data.perClass){
  if(y<72)break;
  second.drawRectangle({x:tableX,y:y-5,width:tw,height:rowH,color:WHITE,borderColor:BORDER,borderWidth:.4});
  text(second,c.name,47,y+1,8,NAVY,false,302);
  text(second,c.summary.total,380,y+1,9,GREY);
  text(second,c.summary.complete,476,y+1,9,GREY);
  text(second,c.summary.completion.toFixed(1)+'%',558,y+1,9,GREY);
  text(second,fmt(data.meta.type==='pbd'?c.summary.meanTp:c.summary.meanScore),688,y+1,9,GREY);
  y-=rowH;
 }
 // 3. Full printable student list with strict row borders and page breaks.
 const allSkills=data.meta.subjectId==='BM'?['Mendengar dan Bertutur','Membaca','Menulis']:data.meta.subjectId==='BI'?['Listening','Speaking','Reading','Writing']:data.skillDistribution.map(x=>x.name);
 const visibleSkills=data.meta.type==='pbd'?allSkills.slice(0,4):[];
 const skillShort=(s:string)=>s==='Mendengar dan Bertutur'?'M&B':s==='Membaca'?'Baca':s==='Menulis'?'Tulis':s==='Listening'?'Listen':s==='Speaking'?'Speak':s==='Reading'?'Read':s==='Writing'?'Write':s.slice(0,6);
 const columns=data.meta.type==='uasa'?[
  ['No',32],['Kelas',140],['Nama Murid',311],['Markah',80],['Gred',60],['Status',143]
 ] as [string,number][]:[
  ['No',32],['Kelas',105],['Nama Murid',210+(4-visibleSkills.length)*43],['TP',40],
  ...visibleSkills.map(s=>[skillShort(s),43] as [string,number]),
  ['Ulasan',78],['Usaha',76],['Status',53]
 ] as [string,number][];
 const sumWidth=columns.reduce((a,c)=>a+c[1],0);
 if(sumWidth>WIDTH-75)throw Error('Lajur laporan terlalu lebar: '+sumWidth);
 let page=addPage();base(page,'Senarai keputusan murid - '+data.meta.subjectName);
 let rowY=HEIGHT-120;
 const drawTableHead=()=>{
  page.drawRectangle({x:38,y:rowY,width:sumWidth,height:25,color:BLUE});
  let x=38;
  for(const [label,w] of columns){text(page,label,x+5,rowY+8,8,WHITE,true,w-9);x+=w}
  rowY-=21;
 };
 text(page,'SENARAI MURID - '+data.meta.title,38,HEIGHT-96,12,NAVY,true,WIDTH-76);
 drawTableHead();
 for(let i=0;i<data.rows.length;i++){
  if(rowY<70){page=addPage();base(page,'Sambungan senarai murid');rowY=HEIGHT-100;drawTableHead()}
  const r=data.rows[i];
  const values=data.meta.type==='uasa'?[
   String(i+1),r.className,r.name,fmt(r.score),r.grade||'-',r.status.replaceAll('_',' ').toUpperCase()
  ]:[
   String(i+1),r.className,r.name,fmt(r.tp),
   ...visibleSkills.map(k=>{const v=r.skills[k];return typeof v==='number'?'TP'+v:v||'-'}),
   r.remarks||'-',r.effort||'-',r.status.replaceAll('_',' ').toUpperCase()
  ];
  const h=19;
  page.drawRectangle({x:38,y:rowY-h+3,width:sumWidth,height:h,color:i%2?WHITE:LIGHT,borderColor:BORDER,borderWidth:.5});
  let x=38;
  columns.forEach(([,w],j)=>{
   text(page,values[j],x+4,rowY-9,7.2,j===2?NAVY:GREY,j===2,w-8);
   page.drawLine({start:{x:x+w,y:rowY-h+3},end:{x:x+w,y:rowY+3},thickness:.35,color:BORDER});
   x+=w;
  });
  rowY-=h;
 }
 // Overall document footer page number, never overlaps with detail table.
 pages.forEach((p,index)=>text(p,'Muka surat '+(index+1)+' / '+pages.length,730,27,8,GREY));
 return pdf.save();
}
