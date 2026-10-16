import {NextRequest,NextResponse} from 'next/server';
import {getTeacher} from '../../../lib/server';
import {buildReport} from '../../../lib/reporting';
import {makeReportPdf} from '../../../lib/report-pdf';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const teacher=await getTeacher();
 if(!teacher)return NextResponse.json({error:'Sila log masuk dahulu'},{status:401,headers:{'Cache-Control':'no-store'}});
 const format=request.nextUrl.searchParams.get('format')||'json';
 if(!['json','pdf'].includes(format))return NextResponse.json({error:'Format laporan tidak sah'},{status:400});
 // Butang analisis dan API JSON adalah khas admin. Guru biasa hanya boleh PDF kelas agihan.
 if(format==='json'&&teacher.role!=='admin')return NextResponse.json({error:'Analisis hanya untuk admin'},{status:403});
 try{
  const result=await buildReport(teacher,request.nextUrl.searchParams);
  if(format==='json'){
   const {rows,...analytics}=result;
   return NextResponse.json(analytics,{headers:{'Cache-Control':'private, no-store'}});
  }
  const file=await makeReportPdf(result);
  const body=new ArrayBuffer(file.byteLength);
  new Uint8Array(body).set(file);
  const label=[result.meta.type,result.meta.subjectId,result.meta.year,result.meta.scope,result.meta.scope==='class'?result.meta.classNames[0]||'kelas':result.meta.level||'sekolah'].join('-').replace(/[^a-zA-Z0-9_-]+/g,'-');
  return new NextResponse(body,{status:200,headers:{
   'Content-Type':'application/pdf',
   'Content-Disposition':'attachment; filename="'+label+'.pdf"',
   'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'
  }});
 }catch(err){
  const message=err instanceof Error?err.message:'Tidak dapat menjana laporan';
  const clientError=/tidak sah|belum disediakan|tidak dijumpai|Pilih|Tiada kelas|tidak mempunyai|hanya untuk admin|tidak layak|tidak ditawarkan/i.test(message);
  if(!clientError)console.error('Report error',err);
  return NextResponse.json({error:clientError?message:'Gagal menjana laporan. Cuba sebentar lagi.'},{status:clientError?400:500,headers:{'Cache-Control':'no-store'}});
 }
}
