'use client';

const schoolLogo='https://i.postimg.cc/3RF9M05N/Logo-SKSA.png';

export function ProcessOverlay({text}:{text:string}){
 return <div className="processOverlay" role="status" aria-live="polite" aria-busy="true">
  <div className="processCard">
   <div className="processSpinner" aria-hidden="true">
    <span className="processRing processRingOuter"/>
    <span className="processRing processRingInner"/>
    <span className="processHalo"/>
    <img src={schoolLogo} alt="" className="processLogo"/>
   </div>
   <strong>{text}</strong>
   <p>Maklumat sedang diproses dengan selamat.</p>
   <div className="processDots" aria-hidden="true"><i/><i/><i/></div>
  </div>
 </div>;
}

export function SaveCelebration({onDismiss}:{onDismiss:()=>void}){
 return <div className="celebrateOverlay" role="dialog" aria-modal="true" aria-label="Maklumat berjaya disimpan">
  <div className="celebrateCard">
   <button type="button" className="celebrateClose" aria-label="Tutup mesej berjaya" onClick={onDismiss}>×</button>
   <div className="celebrateHearts" aria-hidden="true">
    {Array.from({length:22},(_,i)=><span key={i} className={'celebrateHeart celebrateHeart'+(i%4)}>{i%5===0?'✦':'♥'}</span>)}
   </div>
   <div className="celebrateBadge">
    <img src={schoolLogo} alt="Logo SKSA"/>
    <span className="celebrateCheck" aria-hidden="true">✓</span>
   </div>
   <span className="celebrateEyebrow">BERJAYA DISIMPAN</span>
   <h2>MAKLUMAT TELAH DISIMPAN RAPI SEPERTI SAYA SIMPAN RAHSIA KITA BERDUA</h2>
   <p>Rekod murid telah berjaya diterima dan disimpan.</p>
  </div>
 </div>;
}
