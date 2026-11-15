/* 간·담낭 2D 해설 (설계 좌표 520×340, 그림 영역 0–296) */
(function(){
'use strict';
const $=id=>document.getElementById(id),TAU=Math.PI*2,clamp=(x,a,b)=>Math.min(b,Math.max(a,x)),ss=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const bz=(p0,p1,p2,p3,n)=>{n=n||24;const o=[];for(let i=0;i<=n;i++){const t=i/n,u=1-t;o.push([u*u*u*p0[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t*t*t*p3[0],u*u*u*p0[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t*t*t*p3[1]]);}return o;};
const pln=(c,pts,col,w,dash)=>{c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.strokeStyle=col;c.lineWidth=w;c.setLineDash(dash||[]);c.stroke();c.setLineDash([]);};
const plen=pts=>{const L=[0];for(let i=1;i<pts.length;i++)L.push(L[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));return L;};
const pat=(pts,L,d)=>{d=clamp(d,0,L[L.length-1]);let i=1;while(i<L.length-1&&L[i]<d)i++;const q=(d-L[i-1])/Math.max(1e-6,L[i]-L[i-1]);return[pts[i-1][0]+(pts[i][0]-pts[i-1][0])*q,pts[i-1][1]+(pts[i][1]-pts[i-1][1])*q];};
const gdot=(c,x,y,r,col)=>{c.save();c.shadowColor=col;c.shadowBlur=r*3;c.fillStyle=col;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();c.restore();};
const fdots=(c,pts,u,n,r,col,a0,a1)=>{a0=a0||0;a1=a1==null?1:a1;const L=plen(pts),T=L[L.length-1];for(let j=0;j<n;j++){const f=(u+j/n)%1,p=pat(pts,L,(a0+(a1-a0)*f)*T);c.globalAlpha=Math.sqrt(Math.sin(Math.PI*f))||0;gdot(c,p[0],p[1],r,col);}c.globalAlpha=1;};
const ppart=(c,pts,f0,f1,col,w)=>{if(f1<=f0)return;const L=plen(pts),T=L[L.length-1];c.beginPath();for(let i=0;i<=24;i++){const p=pat(pts,L,(f0+(f1-f0)*i/24)*T);i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]);}c.strokeStyle=col;c.lineWidth=w;c.stroke();};
const etx=(c,x,y,t,col,sz,al,wt)=>{c.font=(wt||'500')+' '+(sz||12)+'px "IBM Plex Sans KR",sans-serif';c.textAlign=al||'left';c.fillStyle=col||'#cfe3ee';c.fillText(t,x,y);c.textAlign='left';};
const rrect=(c,x,y,w,h,r)=>{c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();};
const chip=(c,x,y,t,col,al)=>{c.font='600 11px "IBM Plex Sans KR",sans-serif';const w=c.measureText(t).width+12;if(al==='c')x-=w/2;else if(al==='r')x-=w;c.fillStyle='rgba(6,13,22,.88)';rrect(c,x,y-9.5,w,19,5);c.fill();c.strokeStyle=col;c.lineWidth=1;c.stroke();c.fillStyle=col;c.textAlign='left';c.fillText(t,x+6,y+.5);};
const cross=(c,x,y,s,now)=>{const k=.5+.5*Math.sin(now*6);c.save();c.shadowColor='#ff3b4a';c.shadowBlur=10+8*k;c.strokeStyle='#ff4a58';c.lineWidth=3;c.beginPath();c.moveTo(x-s,y-s);c.lineTo(x+s,y+s);c.moveTo(x+s,y-s);c.lineTo(x-s,y+s);c.stroke();c.restore();};
const hsh=(a,b)=>Math.abs(Math.sin(a*12.9898+b*78.233)*43758.5453)%1;
const BILE='#a6e36a',PUS='#d6b84a',PANJ='#ffe08a',PORT='#a08cff',ART='#ff6b6b',VEN='#6e96ff';

/* ── 기본 간담도 도식 ── */
const P={H:[214,132],J:[218,168],N:[184,160],A:[211,252],GB:[150,190]};
const IR=[[70,86],[130,104],[178,122],P.H],IL=[[444,64],[360,90],[280,112],P.H],CHD=[P.H,[217,150],P.J],CBD=[P.J,[222,200],[219,230],P.A],CYS=bz(P.N,[198,150],[206,176],P.J,14);
const DUO=[[318,198],[244,200],[206,218],[196,252],[206,282],[262,292],[340,286],[412,276]],DUOIN=[P.A,[198,262]];
const PD=[[456,224],[400,236],[330,248],[262,258],P.A];
const PV=[[332,276],[300,238],[252,178],P.H];
function liverPath(c){c.beginPath();c.moveTo(34,96);c.bezierCurveTo(24,40,140,18,262,26);c.bezierCurveTo(372,32,474,40,490,70);c.bezierCurveTo(476,92,392,104,316,114);c.bezierCurveTo(266,120,236,140,196,152);c.bezierCurveTo(132,168,52,152,34,96);c.closePath();}
function pancPath(c){c.beginPath();c.moveTo(214,236);c.bezierCurveTo(240,226,300,236,360,226);c.bezierCurveTo(410,218,450,210,466,222);c.bezierCurveTo(470,236,430,244,380,250);c.bezierCurveTo(330,258,290,268,250,282);c.bezierCurveTo(226,288,212,270,214,236);c.closePath();}
function gbPath(c,s){c.save();c.translate(P.GB[0],P.GB[1]);c.rotate(-.55);c.scale(s,s);c.beginPath();c.ellipse(0,8,25,40,0,0,TAU);c.restore();}
function stoneAt(c,x,y,r){c.save();c.fillStyle='#e0bb62';c.strokeStyle='#7a5a1a';c.lineWidth=1.2;c.beginPath();for(let i=0;i<7;i++){const a=i/7*TAU,rr=r*(.85+.25*hsh(x+i,y));i?c.lineTo(x+rr*Math.cos(a),y+rr*Math.sin(a)):c.moveTo(x+rr*Math.cos(a),y+rr*Math.sin(a));}c.closePath();c.fill();c.stroke();c.restore();}
function base(c,o,now){
  o=o||{};const gs=o.gbS||1,dw=o.dil?8:4.2;
  // duodenum & pancreas
  if(o.portal!==false)pln(c,PV,'rgba(160,140,255,.55)',o.portal===2?12:9);
  pln(c,DUO,'rgba(0,0,0,.45)',34);pln(c,DUO,'#c98f78',30);pln(c,DUO,'rgba(255,220,200,.18)',8);
  pancPath(c);c.fillStyle=o.panc?'#d9714f':'#e0bf74';c.fill();if(o.panc){c.save();c.shadowColor='#ff5a3c';c.shadowBlur=20+10*Math.sin(now*4);c.strokeStyle='rgba(255,110,70,.8)';c.lineWidth=2;c.stroke();c.restore();}
  pln(c,PD,o.pdDil?'#fff1b0':'#f6e4a8',o.pdDil?5:2.4);
  // liver
  liverPath(c);const lg=c.createLinearGradient(0,20,0,160);lg.addColorStop(0,o.cirr?'#a07a52':'#9c4338');lg.addColorStop(1,o.cirr?'#6a4a30':'#5c2420');c.fillStyle=lg;c.fill();
  if(o.jaund){c.save();liverPath(c);c.fillStyle='rgba(210,180,50,'+(.35*o.jaund)+')';c.fill();c.restore();}
  if(o.cirr){c.save();liverPath(c);c.clip();for(let i=0;i<70;i++){const x=40+hsh(i,1)*450,y=30+hsh(i,2)*120;c.fillStyle='rgba(255,220,170,.12)';c.beginPath();c.arc(x,y,6+6*hsh(i,3),0,TAU);c.fill();c.strokeStyle='rgba(40,20,10,.35)';c.lineWidth=1;c.stroke();}c.restore();}
  c.strokeStyle='rgba(240,170,160,.5)';c.lineWidth=1.4;liverPath(c);c.stroke();
  // ducts
  const dc=o.pus?'#b7a243':'#5fae45';
  pln(c,IR,dc,dw);pln(c,[[110,70],[150,100]],dc,dw*.6);pln(c,[[90,122],[140,110]],dc,dw*.6);pln(c,IL,dc,dw);pln(c,[[400,92],[350,96]],dc,dw*.6);
  pln(c,CHD,dc,dw+1);pln(c,CBD.slice(0,o.cbdCut||4),dc,o.dil?dw+2:5);if(o.cbdCut)pln(c,CBD.slice(o.cbdCut-1),dc,5);
  pln(c,CYS,dc,3);
  // gallbladder
  gbPath(c,gs);const gg=c.createRadialGradient(140,198,4,150,190,50);gg.addColorStop(0,o.gbInf?'#9bb84a':'#6fc06a');gg.addColorStop(1,o.gbInf?'#5a6e22':'#2e7a3a');c.fillStyle=gg;c.fill();
  c.strokeStyle=o.gbInf?'rgba(255,90,70,'+(.6+.3*Math.sin(now*4))+')':'rgba(200,255,200,.5)';c.lineWidth=o.gbInf?5:1.6;c.stroke();
  // stones
  (o.stones||[]).forEach(s=>{if(s==='gb'){stoneAt(c,138,212,6);stoneAt(c,150,218,5);stoneAt(c,130,202,5);stoneAt(c,146,206,4);}if(s==='neck')stoneAt(c,P.N[0]-2,P.N[1]+2,6.5);if(s==='cbd')stoneAt(c,220,226,6.5);if(s==='amp')stoneAt(c,213,246,5.5);if(Array.isArray(s))stoneAt(c,s[0],s[1],s[2]||6);});
  etx(c,30,24,'간 Liver','#f0d0c8',11,'left','600');etx(c,100,240,'담낭','#bfe8b8',11,'center','600');etx(c,420,270,'십이지장','#f3d2c4',10.5,'center');etx(c,400,214,'췌장','#f6e2a8',10.5,'center');
}
function bileFlow(c,u,o){const col=o.pus?PUS:BILE;
  const R1=IR.concat(CHD.slice(1)),L1=IL.concat(CHD.slice(1));
  if(o.mode==='fill'){fdots(c,R1.concat(CYS.slice().reverse().slice(1),[P.GB]),u,9,2.6,col);fdots(c,L1.concat(CYS.slice().reverse().slice(1),[P.GB]),(u+.5)%1,8,2.6,col);}
  else if(o.mode==='out'){fdots(c,[P.GB].concat(CYS,CBD.slice(1),DUOIN),u,12,2.8,col);fdots(c,R1.concat(CBD.slice(1),DUOIN),(u+.3)%1,8,2.6,col);}
  else if(o.mode==='cbd'){const T=R1.concat(CBD.slice(1));fdots(c,T,u,10,2.6,col,0,.86);fdots(c,L1.concat(CBD.slice(1)),(u+.5)%1,9,2.6,col,0,.86);for(let i=0;i<10;i++)gdot(c,219+(hsh(i,7)-.5)*9,212+(hsh(i,8)-.5)*12,2.4,col);}
  else if(o.mode==='amp'){fdots(c,R1.concat(CBD.slice(1)),u,10,2.6,col,0,.96);fdots(c,PD,(u+.2)%1,8,2.4,PANJ,0,.9);}
  if(o.panj)fdots(c,PD.concat(DUOIN.slice(1)),(u+.4)%1,8,2.2,PANJ);}

/* ── 장면 ── */
const S={};
S.normal={steps:()=>[{d:4.2,cam:[230,150,1],cap:'공복: Oddi 괄약근이 닫혀 담즙이 담낭관을 거꾸로 올라가 담낭에 저장·농축됩니다'},{d:4.6,cam:[200,200,1.35],cap:'식사 후 CCK 분비 → 담낭 수축, 괄약근 이완 → 담즙과 췌액이 Vater 팽대부로'},{d:4.6,cam:[250,120,1.05],cap:'간은 간문맥(약 75%)과 간동맥(약 25%) 두 곳에서 혈액을 받습니다'}],
 draw(c,T,si,p,now){const meal=si===1?ss(0,.3,p):0;base(c,{gbS:si===1?1-.3*ss(0,.6,p):1.04,portal:si===2?2:true},now);bileFlow(c,(now*.35)%1,{mode:si===1?'out':'fill',panj:si===1});
  if(si===2){fdots(c,PV,(now*.4)%1,8,3.4,PORT);fdots(c,[[300,300],[270,240],[240,170],P.H],(now*.6)%1,6,2.2,ART);pln(c,[[300,300],[270,240],[240,170],P.H],'rgba(255,100,100,.6)',3);chip(c,330,200,'간문맥 75%',PORT);chip(c,250,286,'간동맥 25%',ART,'c');}
  if(si===1)chip(c,300,180,'CCK → 담낭 수축','#a6e36a');}};
S.colic={steps:()=>[{d:3.4,cam:[160,190,1.5],cap:'담낭 안에 결석이 있지만 평소에는 증상이 없습니다'},{d:4.6,cam:[175,175,1.9],cap:'기름진 식사 후 담낭이 수축 → 결석이 담낭 경부를 막음 → 막힌 출구를 향해 수축하며 통증'},{d:4,cam:[160,190,1.5],cap:'결석이 다시 떨어지면 통증이 사라집니다 (염증·발열 없음)'},{d:3.4,cam:[230,150,1],cap:'치료: 진통(NSAID), 반복되면 예정 복강경 담낭절제술'}],
 draw(c,T,si,p,now){const imp=si===1?ss(.1,.5,p):si===2?1-ss(0,.4,p):0;const st=['gb',lerp([150,206],[P.N[0]-2,P.N[1]+2],imp).concat([6.5])];
  base(c,{gbS:si===1?1-.12*Math.abs(Math.sin(now*5))*imp:1,stones:st},now);bileFlow(c,(now*.35)%1,{mode:si===1&&imp>.6?'none':'fill'});
  if(si===1&&imp>.6){c.save();c.strokeStyle='rgba(255,210,80,'+(.5+.5*Math.sin(now*9))+')';c.lineWidth=3;c.beginPath();c.moveTo(120,150);c.lineTo(108,166);c.lineTo(122,168);c.lineTo(106,190);c.stroke();c.restore();chip(c,92,140,'내장통 (colic)','#ffcf70','r');}}};
S.chole={steps:()=>[{d:3.6,cam:[175,175,1.9],cap:'결석이 담낭 경부에 박혀 빠지지 않습니다 (impacted stone)'},{d:4.4,cam:[155,190,1.7],cap:'담낭 안 압력 ↑ → 벽 혈류 ↓ → 벽이 붓고 두꺼워지며 화학적 염증'},{d:4.4,cam:[155,190,1.7],cap:'이차 세균 감염 → 발열, 백혈구 증가, Murphy sign'},{d:3.6,cam:[150,200,1.4],cap:'방치하면 괴저 → 천공 → 담즙성 복막염·농양'}],
 draw(c,T,si,p,now){const sw=si===0?0:si===1?p:1;base(c,{gbS:1+.16*sw,gbInf:si>=1,stones:['gb','neck']},now);bileFlow(c,(now*.3)%1,{mode:'none'});
  cross(c,P.N[0],P.N[1]-14,6,now);
  if(si>=2)for(let i=0;i<14;i++){const a=hsh(i,1)*TAU,r=hsh(i,2)*26;c.fillStyle='#d9f06a';c.beginPath();c.ellipse(150+Math.cos(a+now*.6)*r,192+Math.sin(a+now*.6)*r*1.4,2.4,1.4,a,0,TAU);c.fill();}
  if(si===3){c.save();c.globalAlpha=.5+.3*Math.sin(now*3);c.fillStyle='rgba(255,90,60,.35)';c.beginPath();c.arc(120,232,18+6*Math.sin(now*2),0,TAU);c.fill();c.restore();chip(c,92,262,'천공 · 농양','#ff9aa3','c');}
  chip(c,90,160,si>=1?'벽 비후 · 팽대':'경부 매복 결석','#ff9aa3','r');}};
S.cbd={steps:()=>[{d:3.6,cam:[200,190,1.5],cap:'담낭 결석이 담낭관을 지나 총담관으로 내려갑니다'},{d:3.6,cam:[218,215,1.9],cap:'총담관 하부에 걸려 담즙 흐름이 막힙니다'},{d:4.4,cam:[220,140,1.15],cap:'위쪽 담관이 늘어나고 (확장) 담즙이 혈액으로 역류 → 황달, 진한 소변'},{d:3.4,cam:[230,150,1],cap:'치료: ERCP로 괄약근을 절개하고 결석을 꺼냅니다'}],
 draw(c,T,si,p,now){const mv=si===0?p:1,sp=mv<.5?lerp([P.N[0]-2,P.N[1]+2],P.J,mv/.5):lerp(P.J,[220,226],(mv-.5)/.5);
  base(c,{dil:si>=2,jaund:si>=2?ss(0,1,si===2?p:1):0,stones:['gb',sp.concat([6.5])],cbdCut:si>=2?3:0},now);bileFlow(c,(now*.3)%1,{mode:si>=1?'cbd':'fill'});
  if(si>=2){chip(c,300,140,'담관 확장 · 담즙 정체','#ffcf70');chip(c,300,166,'D.bil ↑ · ALP ↑ · GGT ↑','#ffcf70');}}};
S.cholang={steps:()=>[{d:3.4,cam:[218,215,1.8],cap:'총담관이 결석으로 막혀 담즙이 고입니다'},{d:4.2,cam:[215,170,1.5],cap:'고인 담즙에 장내 세균이 자라 감염 → 담관 내압이 계속 오름'},{d:4.4,cam:[215,140,1.2],cap:'압력에 밀린 세균·독소가 간정맥으로 넘어감 → 균혈증, 패혈성 쇼크'},{d:3.4,cam:[230,150,1],cap:'원인보다 배액이 먼저: 항생제 + 응급 담도 배액 (ERCP, PTBD)'}],
 draw(c,T,si,p,now){base(c,{dil:1,pus:si>=1,jaund:.5,stones:['gb','cbd'],cbdCut:3},now);bileFlow(c,(now*.3)%1,{mode:'cbd',pus:si>=1});
  if(si>=1)for(let i=0;i<22;i++){const L=IR.concat(CHD.slice(1)),T2=plen(L),q=pat(L,T2,hsh(i,4)*T2[T2.length-1]);c.fillStyle='#e9ff7a';c.beginPath();c.ellipse(q[0]+(hsh(i,5)-.5)*6,q[1]+(hsh(i,6)-.5)*6,2.6,1.4,i,0,TAU);c.fill();}
  if(si>=2){const pts=[[180,120],[160,80],[150,40],[150,6]];pln(c,pts,'rgba(110,150,255,.6)',6);fdots(c,pts,(now*.6)%1,7,3,'#ff7a6a');chip(c,140,40,'균혈증 → 쇼크','#ff9aa3','r');}
  if(si>=1){for(let k=0;k<3;k++){const y=150+((now*30+k*12)%36);c.strokeStyle='rgba(255,200,90,.7)';c.lineWidth=2;c.beginPath();c.moveTo(232,y);c.lineTo(240,y-5);c.lineTo(248,y);c.stroke();}chip(c,256,140,'내압 ↑','#ffcf70');}}};
S.gsp={steps:()=>[{d:3.6,cam:[215,240,2],cap:'결석이 Vater 팽대부에 걸려 담관과 췌관의 공통 출구가 막힙니다'},{d:4.2,cam:[300,240,1.4],cap:'췌액이 빠져나가지 못해 췌관 압력 ↑ → 췌장 안에서 trypsin이 활성화'},{d:4.4,cam:[320,240,1.3],cap:'췌장이 스스로를 소화: 부종, 지방괴사, 주변으로 염증이 번짐 → 전신 염증 반응'},{d:3.4,cam:[230,150,1],cap:'수액·진통·조기 영양이 기본. ERCP는 담관염 동반·지속 폐색일 때만'}],
 draw(c,T,si,p,now){base(c,{panc:si>=2,pdDil:si>=1,stones:['gb','amp'],jaund:.2},now);bileFlow(c,(now*.3)%1,{mode:'amp'});cross(c,P.A[0]+14,P.A[1]+4,5,now);
  if(si>=2){c.save();c.globalAlpha=.25+.15*Math.sin(now*3);c.strokeStyle='#ff6a4a';c.lineWidth=14;c.setLineDash([3,7]);pancPath(c);c.stroke();c.restore();chip(c,400,192,'췌장 자가 소화 · 부종','#ff9aa3','c');}
  if(si===1)chip(c,350,272,'췌관 압력 ↑','#ffcf70','c');}};
// micro view: hepatocytes
function cells(c,dead,glut,now){for(let r=0;r<6;r++)for(let q=0;q<10;q++){const x=60+q*42+(r%2)*21,y=40+r*36,d=dead>hsh(q,r);c.beginPath();for(let k=0;k<6;k++){const a=k/6*TAU+Math.PI/6;k?c.lineTo(x+20*Math.cos(a),y+20*Math.sin(a)):c.moveTo(x+20*Math.cos(a),y+20*Math.sin(a));}c.closePath();
  c.fillStyle=d?'#3a2620':'#a24a3e';c.fill();c.strokeStyle='rgba(255,200,190,.35)';c.lineWidth=1;c.stroke();if(!d){c.fillStyle='rgba(60,20,30,.8)';c.beginPath();c.arc(x,y,4,0,TAU);c.fill();}
  if(!d&&glut>0){for(let k=0;k<3;k++)gdot(c,x-8+k*8,y+9,1.6*glut+.2,'#7cf5a6');}}}
S.alf={steps:()=>[{d:3.6,cam:[260,140,1],cap:'정상 간세포는 아세트아미노펜 일부를 독성 대사물 NAPQI로 바꾸고, 글루타티온(초록)으로 중화합니다'},{d:4.4,cam:[260,140,1.1],cap:'과량 복용 → 글루타티온 고갈 → NAPQI가 간세포를 손상'},{d:4.6,cam:[260,140,1],cap:'간세포 대량 괴사 → INR ↑ (응고인자 ↓), 암모니아 ↑ → 뇌병증, 저혈당'},{d:4.2,cam:[260,140,1],cap:'N-acetylcysteine가 글루타티온을 다시 채워 손상을 막습니다 (빠를수록 효과)'}],
 draw(c,T,si,p,now){const dead=si<1?0:si===1?.25*p:si===2?.25+.5*p:.75,gl=si===0?1:si===1?1-p:si===2?0:p;cells(c,dead,gl,now);
  if(si>=1)for(let i=0;i<24;i++){const x=40+((now*30+hsh(i,1)*440)%440),y=30+hsh(i,2)*210;gdot(c,x,y,2.2,'#ff9a3d');}
  if(si===3)for(let i=0;i<16;i++){gdot(c,60+((now*40+hsh(i,3)*420)%420),40+hsh(i,4)*200,2.4,'#62d6ff');}
  chip(c,500,270,si===3?'NAC (파랑) → 글루타티온 회복':si>=1?'NAPQI (주황)':'글루타티온 (초록)',si===3?'#62d6ff':si>=1?'#ff9a3d':'#7cf5a6','r');}};
// portal hypertension view
function portalView(c,o,now){
  const liverP=c2=>{c2.beginPath();c2.moveTo(30,80);c2.bezierCurveTo(30,30,140,20,220,40);c2.bezierCurveTo(250,60,240,110,200,130);c2.bezierCurveTo(140,150,40,140,30,80);c2.closePath();};
  liverP(c);c.fillStyle=o.cirr?'#8c6a46':'#8e3b32';c.fill();if(o.cirr){c.save();liverP(c);c.clip();for(let i=0;i<40;i++){c.fillStyle='rgba(255,220,170,.14)';c.beginPath();c.arc(40+hsh(i,1)*200,30+hsh(i,2)*110,7+5*hsh(i,3),0,TAU);c.fill();c.strokeStyle='rgba(40,20,10,.4)';c.stroke();}c.restore();}
  etx(c,60,60,o.cirr?'간경변 (섬유화·결절)':'간',o.cirr?'#ffd7a8':'#f0d0c8',12,'left','600');
  c.fillStyle='#8a3550';c.beginPath();c.ellipse(440,170,o.spl?54:38,o.spl?70:50,.3,0,TAU);c.fill();etx(c,440,250,o.spl?'비장 비대':'비장','#e8b0c8',11,'center','600');
  c.fillStyle='#cf8f86';c.beginPath();c.moveTo(300,60);c.bezierCurveTo(380,50,420,90,400,130);c.bezierCurveTo(380,170,320,160,300,130);c.closePath();c.fill();etx(c,352,104,'위','#f6d5ce',11,'center','600');
  c.fillStyle='rgba(217,154,138,.9)';c.fillRect(300,-10,26,76);etx(c,336,22,'식도','#f6d5ce',11,'left','600');
  const PVm=[[200,250],[200,190],[170,130]],SPL=[[400,190],[300,200],[200,195]],SMV=[[190,300],[200,250]],LG=[[220,190],[260,150],[300,110],[313,60],[313,0]];
  pln(c,SMV,PORT,10);pln(c,SPL,PORT,10);pln(c,PVm,PORT,o.cirr?16:12);
  etx(c,150,268,'상장간막정맥','#c8bcff',10.5,'right');etx(c,300,220,'비정맥','#c8bcff',10.5,'center');etx(c,212,170,'간문맥','#c8bcff',11,'left','600');
  return {PVm,SPL,SMV,LG};}
S.varix={steps:()=>[{d:3.6,cam:[220,150,1],cap:'정상: 장·비장의 혈액이 간문맥으로 모여 간을 통과합니다'},{d:4.2,cam:[180,130,1.2],cap:'간경변: 섬유화된 간이 혈류를 막아 간문맥 압력 ↑ (문맥고혈압), 비장 비대'},{d:4.4,cam:[300,90,1.45],cap:'막힌 길을 피해 좌위정맥 → 식도 정맥으로 우회 → 점막 아래 정맥이 늘어남 (정맥류)'},{d:3.8,cam:[313,40,2.1],cap:'얇은 벽이 터지면 대량 토혈 → 출혈성 쇼크'}],
 draw(c,T,si,p,now){const cir=si>=1,o=portalView(c,{cirr:cir,spl:cir},now);
  fdots(c,o.SMV.concat(o.PVm.slice(1)),(now*(cir?.15:.5))%1,6,3.4,'#cdbfff');fdots(c,o.SPL.concat(o.PVm.slice(1)),(now*(cir?.15:.5)+.4)%1,7,3.4,'#cdbfff');
  if(cir){for(let k=0;k<3;k++){const y=150+((now*30+k*12)%36);c.strokeStyle='rgba(255,200,90,.7)';c.lineWidth=2;c.beginPath();c.moveTo(170,y+30);c.lineTo(178,y+25);c.lineTo(186,y+30);c.stroke();}chip(c,120,200,'문맥압 ↑','#ffcf70','r');}
  if(si>=2){const sw=si===2?p:1;pln(c,o.LG,'rgba(150,130,255,.8)',4+4*sw);fdots(c,o.LG,(now*.5)%1,8,3,'#cdbfff');for(let k=0;k<4;k++){c.fillStyle='rgba(90,100,240,.85)';c.beginPath();c.ellipse(306+(k%2)*14,12+k*14,5+5*sw,7+3*sw,0,0,TAU);c.fill();}chip(c,360,40,'식도정맥류','#a9c8ff');}
  if(si===3){for(let i=0;i<26;i++){const a=hsh(i,1)*TAU,r=((now*40+hsh(i,2)*40)%40);gdot(c,320+Math.cos(a)*r,30+Math.sin(a)*r*.6+r*.4,2.4,'#ff4050');}chip(c,380,70,'정맥류 파열 · 출혈','#ff9aa3');}}};
S.he={steps:()=>[{d:3.8,cam:[220,150,1],cap:'장에서 단백질이 분해되며 암모니아(NH₃)가 생깁니다'},{d:4,cam:[160,120,1.15],cap:'정상: 간문맥 → 간에서 요소로 바뀌어 해독됩니다'},{d:4.6,cam:[260,120,1],cap:'간경변: 간 기능 저하 + 측부 순환으로 간을 건너뜀 → 암모니아가 뇌로'},{d:3.8,cam:[220,150,1],cap:'lactulose가 장에서 암모니아 흡수를 줄이고, rifaximin이 생성균을 줄입니다'}],
 draw(c,T,si,p,now){const o=portalView(c,{cirr:si>=2,spl:si>=2},now);
  c.fillStyle='#d9a38a';rrect(c,120,280,180,40,14);c.fill();etx(c,210,300,'장 (단백질 → NH₃)','#4a2a20',11,'center','600');
  fdots(c,o.SMV.concat(o.PVm.slice(1)),(now*.4)%1,8,3,'#ffd060');
  if(si===1||si===3)for(let i=0;i<8;i++)gdot(c,60+((now*30+hsh(i,1)*150)%150),70+hsh(i,2)*50,2.6,si===3?'#7cf5a6':'#7cf5a6');
  c.fillStyle='rgba(230,200,230,.9)';c.beginPath();c.ellipse(470,40,40,28,0,0,TAU);c.fill();etx(c,470,42,'뇌','#402040',12,'center','600');
  if(si===2){const sh=[[200,195],[260,150],[300,110],[313,30],[420,30]];pln(c,sh,'rgba(150,130,255,.8)',6);fdots(c,sh,(now*.5)%1,10,3,'#ffd060');chip(c,470,86,'NH₃ ↑ → 의식 저하','#ff9aa3','c');}
  if(si===3){chip(c,210,262,'lactulose · rifaximin','#62d6ff','c');}}};
S.abscess={steps:()=>[{d:3.6,cam:[200,90,1.4],cap:'담도·장에서 온 세균이 간 안에 자리 잡습니다'},{d:4.4,cam:[150,90,1.8],cap:'고름이 고여 주머니(농양)가 생기고, 테두리에 염증 혈관이 늘어납니다'},{d:3.8,cam:[150,90,1.8],cap:'5 cm가 넘으면 항생제만으로는 잘 낫지 않아 배액이 필요합니다'}],
 draw(c,T,si,p,now){base(c,{portal:true},now);const r=si===0?6:si===1?6+30*p:36;
  if(si===0)for(let i=0;i<10;i++)gdot(c,150+(hsh(i,1)-.5)*30,90+(hsh(i,2)-.5)*20,2,'#e9ff7a');
  c.save();c.shadowColor='#ff5040';c.shadowBlur=14+6*Math.sin(now*3);c.fillStyle='#d9c25a';c.beginPath();c.arc(150,90,r,0,TAU);c.fill();c.strokeStyle='#ff6a50';c.lineWidth=4;c.stroke();c.restore();
  if(si>=1)chip(c,200,58,'간농양','#ff9aa3');}};
S.hcc={steps:()=>[{d:3.6,cam:[130,80,1.6],cap:'간세포암은 주로 간동맥에서 혈액을 받는, 혈관이 풍부한 종양입니다'},{d:4,cam:[110,70,2],cap:'간 표면 가까이 자란 종양이 터지면'},{d:4.4,cam:[150,140,1.1],cap:'복강 안으로 대량 출혈 → 혈복강, 출혈성 쇼크 → 긴급 간동맥 색전술'}],
 draw(c,T,si,p,now){base(c,{cirr:true},now);const ha=[[300,300],[270,240],[240,170],P.H,[160,110],[118,78]];pln(c,ha,'rgba(255,100,100,.75)',3.5);fdots(c,ha,(now*.6)%1,8,2.4,ART);
  c.fillStyle='#d4ae78';c.beginPath();c.arc(108,62,22,0,TAU);c.fill();c.strokeStyle='#ffdca8';c.lineWidth=1.5;c.stroke();chip(c,140,40,'간세포암 (HCC)','#ffcf70');
  if(si>=1){cross(c,100,44,6,now);for(let i=0;i<(si===2?40:14);i++){const a=-.3-hsh(i,1)*2.4,r=((now*50+hsh(i,2)*90)%90);gdot(c,100+Math.cos(a)*r*.8,44-Math.sin(a)*r*.2+r*(si===2?1.6:.5),2.2,'#ff3a48');}}
  if(si===2){c.fillStyle='rgba(200,30,40,.25)';c.beginPath();c.ellipse(120,250,90,30,0,0,TAU);c.fill();chip(c,120,250,'혈복강','#ff9aa3','c');}}};
/* ── 시술 ── */
S.ercp={steps:o=>[{d:o.cond?4.6:3.4,cam:[260,160,1],cap:o.cond?'담석성 췌장염의 ERCP는 담관염 동반·폐색 지속 시에만. 아래는 그 경우의 시술':'내시경(측시경)을 입 → 위 → 십이지장 2부까지 넣습니다'},{d:3.6,cam:[212,248,2.2],cap:'유두를 정면으로 보고 카테터와 가이드와이어로 담관에 삽관 (cannulation)'},
  {d:3.4,cam:[212,248,2.6],cap:'유두괄약근절개 (EST): 전기 칼로 출구를 넓힙니다'},{d:4.6,cam:[216,228,2.2],cap:o.stent?'중증 담관염: 우선 스텐트·배액관으로 고름을 빼냅니다 (결석은 나중에)':'풍선으로 결석을 끌어내 십이지장으로 빼냅니다'},{d:3.4,cam:[230,170,1.2],cap:'담즙이 다시 흐르고, 막혀 있던 담관 압력이 내려갑니다'}],
 draw(c,T,si,p,now,o){const done=si>=4,sweep=si===3&&!o.stent?ss(.15,.85,p):0;const stPos=done&&!o.stent?null:(sweep?lerp([220,226],[200,262],sweep):[220,226]);
  base(c,{dil:!done,stones:['gb'].concat(stPos?[stPos.concat([6.5])]:[]),cbdCut:done?0:3,pus:o.stent&&!done,jaund:done?0:.4},now);
  bileFlow(c,(now*.35)%1,{mode:done?'out':'cbd',pus:o.stent&&!done});
  const scope=[[520,-10],[420,120],[300,196],[236,226],[214,238]],gr=si===0?ss(0,.9,p):1;ppart(c,scope,0,gr,'#2a3440',18);ppart(c,scope,0,gr,'#55606c',12);
  if(si>=1){const cw=si===1?ss(.2,.9,p):1;ppart(c,[[214,240],P.A,[219,230],[222,200]],0,cw,'#e8eef4',2);}
  if(si===2){const k=Math.sin(now*30)>0;pln(c,[[212,250],[218,240]],k?'#ff6a50':'#ffd0a0',3);for(let i=0;i<6;i++)gdot(c,214+(hsh(i,Math.floor(now*20))-.5)*10,246+(hsh(i+3,Math.floor(now*20))-.5)*10,1.6,'#ffd27a');}
  if(si===3&&!o.stent){const b=lerp([222,214],[202,266],sweep);c.fillStyle='rgba(159,232,255,.45)';c.beginPath();c.ellipse(b[0],b[1],7,9,0,0,TAU);c.fill();c.strokeStyle='#bff0ff';c.lineWidth=1.4;c.stroke();}
  if(si>=3&&o.stent){const sg=si===3?ss(0,.6,p):1;ppart(c,[[204,262],P.A,[219,230],[222,200],[218,170]],0,sg,'#7fd0ff',4);if(sg>.9)fdots(c,[[218,175],[222,200],[219,230],P.A,[198,266]],(now*.5)%1,8,2.6,PUS);}}};
S.lapchole={steps:()=>[{d:3.4,cam:[200,150,1],cap:'배꼽과 상복부에 3–4개의 투관침(trocar)을 넣고 이산화탄소로 배를 부풀립니다'},{d:3.6,cam:[170,170,1.5],cap:'담낭 바닥을 위로 들어 올려 Calot 삼각을 펼칩니다'},
  {d:4.4,cam:[195,165,2.1],cap:'안전 확인 시야 (critical view of safety): 담낭관과 담낭동맥 두 구조만 담낭으로 들어가는지 확인'},{d:3.8,cam:[195,165,2.1],cap:'클립으로 담낭관과 담낭동맥을 묶고 자릅니다'},{d:3.6,cam:[180,140,1.2],cap:'담낭을 간에서 떼어 꺼냅니다. 총담관은 그대로 보존'}],
 draw(c,T,si,p,now){const lift=si===0?0:si===1?p:1,gone=si===4?ss(.2,1,p):0;
  c.save();c.translate(0,-36*lift*(1-gone)-80*gone);c.globalAlpha=1-gone;
  base(c,{stones:['gb','neck'],gbInf:true,portal:false},now);c.restore();
  if(gone<1){const ca=[[240,170],[214,162],[192,170]];pln(c,ca,'#ff6b6b',2.4);etx(c,246,176,'담낭동맥','#ff9a9a',10);}
  [[90,20],[230,10],[330,30],[150,0]].forEach((q,i)=>{c.fillStyle='#8d99a6';c.beginPath();c.arc(q[0],q[1]+4,7,0,TAU);c.fill();const tip=i===0?[140,170-36*lift]:i===1?[196,165]:i===2?[206,170]:[160,150];if(si>=1)pln(c,[[q[0],q[1]+4],tip],'#b9c3cc',3);});
  if(si>=3){[[194,160],[200,166],[188,170],[198,176]].forEach((q,i)=>{if(si===3&&p<i*.2)return;c.fillStyle='#e8eef4';c.save();c.translate(q[0],q[1]);c.rotate(.6);c.fillRect(-1.5,-5,3,10);c.restore();});chip(c,250,140,'클립 · 절단','#e8eef4');}
  if(si===2)chip(c,250,140,'Calot 삼각 · CVS','#a6e36a');}};
S.evl={steps:()=>[{d:3.4,cam:[260,150,1],cap:'식도 아래쪽 점막 아래 굵은 정맥류에서 피가 납니다'},{d:3.6,cam:[260,140,1.2],cap:'끝에 결찰 캡을 단 내시경으로 정맥류에 다가갑니다'},{d:3.6,cam:[260,170,1.5],cap:'흡인으로 정맥류를 캡 안으로 빨아들입니다'},{d:4,cam:[260,170,1.5],cap:'고무 밴드를 걸어 묶으면 혈류가 끊기고 출혈이 멈춥니다'},{d:3.6,cam:[260,150,1],cap:'며칠 뒤 묶인 정맥류는 괴사해 떨어지고 흉터로 아뭅니다'}],
 draw(c,T,si,p,now){c.fillStyle='#5a2a2a';c.fillRect(140,0,240,296);c.fillStyle='#c97a70';c.fillRect(160,0,200,296);const g=c.createLinearGradient(160,0,360,0);g.addColorStop(0,'rgba(0,0,0,.35)');g.addColorStop(.5,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.35)');c.fillStyle=g;c.fillRect(160,0,200,296);
  etx(c,130,20,'식도 (종단면)','#f6d5ce',11,'right','600');
  const vx=310,vy=190,suck=si===2?p:si>=3?1:0,band=si>=3;
  [[200,120,1],[330,90,.8],[230,230,.9]].forEach(q=>{c.fillStyle='#5864e8';c.beginPath();c.ellipse(q[0],q[1],14*q[2],26*q[2],0,0,TAU);c.fill();});
  c.save();c.translate(vx-suck*24,vy);c.fillStyle=band&&si===4?'#3a2a4a':(band?'#4a3a8a':'#5864e8');c.beginPath();c.ellipse(0,0,18+suck*4,30-suck*6,0,0,TAU);c.fill();c.restore();
  if(si===0){for(let i=0;i<20;i++){const r=((now*40+hsh(i,1)*40)%40),a=hsh(i,2)*Math.PI-Math.PI/2;gdot(c,vx-14-Math.cos(a)*r,vy+Math.sin(a)*r,2.2,'#ff4050');}chip(c,380,190,'활동성 출혈','#ff9aa3');}
  if(si>=1&&si<4){const sx=si===1?ss(0,.9,p):1,x=260,y=-20+190*sx;c.fillStyle='#2a3440';c.fillRect(x-24,-20,48,y+20);c.fillStyle='rgba(200,230,255,.45)';c.fillRect(x-28,y,56,22);c.strokeStyle='#bfe8ff';c.strokeRect(x-28,y,56,22);}
  if(band){c.strokeStyle='#e8d0ff';c.lineWidth=4;c.beginPath();c.ellipse(vx-24,vy+18,16,5,0,0,TAU);c.stroke();chip(c,380,220,si===4?'괴사 · 탈락':'밴드 결찰','#e8d0ff');}}};
S.drain={steps:()=>[{d:3.4,cam:[200,140,1],cap:'초음파로 농양의 위치와 피부에서의 경로를 확인합니다'},{d:3.8,cam:[130,110,1.4],cap:'국소마취 후 바늘을 피부 → 간 → 농양으로 넣습니다 (혈관·폐를 피함)'},{d:3.6,cam:[150,90,1.8],cap:'가이드와이어를 따라 끝이 말린 배액관 (pigtail)을 둡니다'},{d:4.4,cam:[150,90,1.6],cap:'고름이 빠지면서 농양이 줄어듭니다. 항생제는 계속'}],
 draw(c,T,si,p,now){base(c,{portal:true},now);const r=si<3?36:36-22*p;c.save();c.shadowColor='#ff5040';c.shadowBlur=12;c.fillStyle='#d9c25a';c.beginPath();c.arc(150,90,r,0,TAU);c.fill();c.strokeStyle='#ff6a50';c.lineWidth=4;c.stroke();c.restore();
  c.fillStyle='#8a96a3';rrect(c,20,4,60,22,6);c.fill();etx(c,50,15,'초음파','#0c1622',10.5,'center','600');
  const nd=[[40,-10],[150,90]];if(si>=1){const g=si===1?ss(0,.9,p):1;ppart(c,nd,0,g,'#e8eef4',2);}
  if(si>=2){c.strokeStyle='#7fd0ff';c.lineWidth=3;c.beginPath();c.arc(150,90,9,0,TAU*.85);c.stroke();pln(c,nd,'#7fd0ff',3);}
  if(si===3)fdots(c,[[150,90],[40,-10]],(now*.5)%1,8,3,'#e8d26a');}};
S.tae={steps:()=>[{d:3.6,cam:[260,170,1],cap:'대퇴동맥으로 카테터를 넣어 대동맥 → 복강동맥 → 총간동맥으로 올라갑니다'},{d:3.6,cam:[180,110,1.4],cap:'조영으로 출혈하는 종양의 영양 동맥을 찾습니다 (조영제 유출)'},{d:4.4,cam:[130,80,1.8],cap:'색전 물질 (gelfoam 등)을 넣어 영양 동맥을 막습니다'},{d:3.6,cam:[150,120,1.1],cap:'종양으로 가는 혈류가 끊기고 출혈이 멈춥니다. 간문맥 혈류로 간은 유지'}],
 draw(c,T,si,p,now){base(c,{cirr:true},now);const ha=[[300,300],[270,240],[240,170],P.H,[160,110],[118,78]];pln(c,ha,'rgba(255,100,100,.75)',3.5);
  c.fillStyle='#d4ae78';c.beginPath();c.arc(108,62,22,0,TAU);c.fill();
  const g=si===0?ss(0,.9,p):1;ppart(c,ha,0,g*(si>=1?.95:.6),'#e8eef4',2.2);
  if(si<=2){const bl=si===1?1:si===2?1-p:0;for(let i=0;i<Math.round(14*bl);i++){gdot(c,100+(hsh(i,1)-.5)*30,48+((now*40+hsh(i,2)*40)%40),2.2,'#ff3a48');}}
  if(si===1){c.save();c.globalAlpha=.6;c.fillStyle='#1a1a1a';c.beginPath();c.arc(108,62,24,0,TAU);c.fill();c.restore();chip(c,140,40,'조영제 유출','#ff9aa3');}
  if(si>=2){fdots(c,ha.slice(3),(now*.5)%1,6,2.6,'#e8e0c0',0,si===2?p:1);if(si===3)chip(c,140,40,'색전 · 지혈','#7cf5a6');}}};

/* ── 감독 ── */
const EXM={normal:{m:'normal'},colic:{m:'colic'},chole:{m:'chole',t:'lapchole'},cbd:{m:'cbd',t:'ercp'},cholang:{m:'cholang',t:'ercp'},gsp:{m:'gsp',t:'ercp'},alf:{m:'alf'},varix:{m:'varix',t:'evl'},he:{m:'he'},abscess:{m:'abscess',t:'drain'},hcc:{m:'hcc',t:'tae'}};
const exC=$('exC'),ec=exC.getContext('2d');let on=false,run=false,page='m',t0=0,cur=null;
const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
function open(sc,pg){cur=sc;const m=EXM[sc.id]||{m:'normal'};page=pg==='t'&&m.t?'t':'m';on=true;t0=performance.now()/1000;
  $('expl').classList.add('on');$('exT').textContent=sc.name;const tp=$('exTopics');tp.innerHTML='';
  [['m','기전 · 무슨 일이 일어나나'],['t',sc.txn||'치료']].forEach(([k,nm])=>{if(k==='t'&&!m.t)return;const b=document.createElement('button');b.type='button';b.className='ib';b.textContent=nm;b.setAttribute('aria-pressed',k===page);b.addEventListener('click',()=>open(sc,k));tp.appendChild(b);});
  $('exD').innerHTML=page==='m'?sc.patho:'<ul>'+sc.er.map(x=>'<li>'+x+'</li>').join('')+'</ul>';
  const d=Math.min(devicePixelRatio||1,3);exC.width=Math.max(1,exC.clientWidth*d);exC.height=Math.max(1,exC.clientHeight*d);loop();}
function loop(){if(!on||run)return;run=true;const st=()=>{if(!on){run=false;return;}draw(performance.now()/1000);requestAnimationFrame(st);};st();}
$('exX').addEventListener('click',()=>{on=false;$('expl').classList.remove('on');});
function draw(now){const W=exC.clientWidth,H=exC.clientHeight,c=ec,d=Math.min(devicePixelRatio||1,3),m=EXM[cur.id]||{m:'normal'},nm=page==='t'?m.t:m.m,o=cur.txo||{},Sc=S[nm];
  c.setTransform(d,0,0,d,0,0);const g0=c.createLinearGradient(0,0,0,H);g0.addColorStop(0,'#0c1826');g0.addColorStop(1,'#03060a');c.fillStyle=g0;c.fillRect(0,0,W,H);
  const s=Math.min(W/520,H/340);c.save();c.translate((W-520*s)/2,(H-340*s)/2);c.scale(s,s);c.lineJoin='round';c.lineCap='round';c.textBaseline='middle';
  const st=Sc.steps(o);let tot=0;st.forEach(x=>{x.t0=tot;tot+=x.d;});const T=(now-t0)%tot;let si=0;while(si<st.length-1&&T>=st[si].t0+st[si].d)si++;
  const loc=T-st[si].t0,p=loc/st[si].d,a=st[(si+st.length-1)%st.length].cam,b=st[si].cam,e=ease(clamp(loc/1.1,0,1)),cx=a[0]+(b[0]-a[0])*e,cy=a[1]+(b[1]-a[1])*e,z=a[2]+(b[2]-a[2])*e;
  c.save();c.beginPath();c.rect(0,0,520,296);c.clip();c.translate(260,148);c.scale(z,z);c.translate(-cx,-cy);Sc.draw(c,T,si,p,now,o);c.restore();
  const vg=c.createRadialGradient(260,148,120,260,148,330);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.55)');c.fillStyle=vg;c.fillRect(0,0,520,296);
  c.fillStyle='#03060a';c.fillRect(0,296,520,44);c.strokeStyle='rgba(120,190,220,.2)';c.lineWidth=1;c.beginPath();c.moveTo(0,296.5);c.lineTo(520,296.5);c.stroke();
  c.globalAlpha=clamp(loc/.5,0,1);const cap=st[si].cap;let fz=12.5;c.font='500 '+fz+'px "IBM Plex Sans KR",sans-serif';while(c.measureText(cap).width>500&&fz>8.5){fz-=.5;c.font='500 '+fz+'px "IBM Plex Sans KR",sans-serif';}
  c.textAlign='center';c.fillStyle='#eef4f8';c.fillText(cap,260,313);c.textAlign='left';c.globalAlpha=1;
  const w=8,gap=6,x0=260-(st.length*(w+gap)-gap)/2;st.forEach((x,i)=>{c.fillStyle=i===si?'#57d3e6':i<si?'rgba(87,211,230,.45)':'rgba(255,255,255,.16)';rrect(c,x0+i*(w+gap),329,i===si?w+10*p:w,4,2);c.fill();});
  c.restore();}
window.HEX={open};
})();
