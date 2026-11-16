(function(){
'use strict';
const $=id=>document.getElementById(id);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const ss=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const gs=(x,c,w)=>{const d=(x-c)/w;return Math.exp(-d*d);};
const TAU=Math.PI*2,jit=a=>(Math.random()*2-1)*a;
const DBG=new URLSearchParams(location.search).get('dbg');
const VER='Ver.cardio 28';

/* ───────────── 1. 합성 ECG: 심장 쌍극자(x=좌, y=하, z=전)를 12유도로 투영 ───────────── */
const LEADS=['I','II','III','aVR','aVL','aVF','V1','V2','V3','V4','V5','V6'];
const LM=[[1,0,0],[.5,.87,0],[-.5,.87,0],[-.75,-.43,0],[.75,-.43,0],[0,.87,0],[-.6,0,1],[0,0,1.3],[.55,.05,1.1],[1.05,.1,.6],[1.15,.1,.1],[1,.1,-.25]];
const NQ=[[[-.12,-.06,.22],.012,.008],[[.75,.75,-.38],.035,.011],[[-.1,-.1,-.3],.058,.009]];
const MORPH={
  n:{c:NQ,end:.08,t:[.22,.2,.12],tw:.05},
  lbbb:{c:[[[.55,.25,-.6],.045,.02],[[.65,.3,-.7],.098,.024]],end:.15,t:[-.3,-.1,.35],st:[-.08,-.02,.12],tw:.06},
  rbbb:{c:[NQ[0],[[.75,.75,-.3],.035,.011],[[-.4,-.05,.55],.096,.024]],end:.14,t:[.25,.2,-.12],tw:.05},
  pvc:{c:[[[.5,1.1,-1],.07,.036],[[.2,.4,-.3],.135,.03]],end:.17,t:[-.3,-.5,.5],st:[-.05,-.1,.12],tw:.07},
  esc:{c:[[[.4,.85,-.8],.07,.036],[[.15,.3,-.25],.135,.03]],end:.17,t:[-.25,-.4,.4],st:[-.04,-.08,.1],tw:.07},
  vt:{c:[[[-.5,-.9,.8],.06,.036],[[.4,.6,-.6],.165,.046]],end:.2,tw:.05},
  stA:{c:[NQ[0],[[.7,.7,-.75],.035,.012],NQ[2]],end:.08,t:[.25,.15,.4],st:[.12,-.05,.36],tw:.055},
  stI:{c:[[[0,-.25,0],.014,.009],[[.7,.65,-.35],.036,.011]],end:.08,t:[.12,.35,0],st:[-.08,.3,-.05],tw:.055},
  hk:{c:[[[.6,.6,-.3],.05,.021],[[-.35,-.45,-.3],.118,.03]],end:.16,t:[.5,.6,.7],tw:.03}
};
MORPH.isc={c:NQ,end:.08,t:[-.1,-.06,.04],st:[-.13,-.09,-.02],tw:.055};
MORPH.lvh={c:[NQ[0],[[1.25,.8,-.95],.036,.012],[[-.1,-.1,-.45],.06,.01]],end:.09,t:[-.22,-.1,.16],st:[-.09,-.03,.1],tw:.06};
const dip=[0,0,0];
function addWave(e,tau){
  const m=MORPH[e.m],a=e.amp;
  for(const g of m.c){const k=a*gs(tau,g[1],g[2]);dip[0]+=g[0][0]*k;dip[1]+=g[0][1]*k;dip[2]+=g[0][2]*k;}
  const tc=Math.max(m.end+.13,e.qt-.05);
  if(m.t){const k=a*gs(tau,tc,tau<tc?m.tw*1.5:m.tw*.9);dip[0]+=m.t[0]*k;dip[1]+=m.t[1]*k;dip[2]+=m.t[2]*k;}
  if(m.st){const k=a*sim.stK*ss(m.end-.02,m.end+.01,tau)*(1-ss(tc-.03,tc+.06,tau));dip[0]+=m.st[0]*k;dip[1]+=m.st[1]*k;dip[2]+=m.st[2]*k;}
}

/* ───────────── 2. 시뮬레이션 상태 ───────────── */
const sim={stK:1,t:0,P:[],V:[],s:{t:0},sc:null,n:0,src:'syn',real:null,r0:0,loopHz:5};
const addP=(t,o)=>sim.P.push(Object.assign({t,amp:1,kind:'sinus',blocked:false,pr:.16},o));
function addV(t,o){
  const e=Object.assign({t,m:'n',mech:1,lvD:0,rvD:0,org:'his',amp:1,rr:.8},o);
  e.qt=clamp(.4*Math.sqrt(e.rr),.24,.46);if(e.end==null)e.end=MORPH[e.m].end;sim.V.push(e);
}
const SC=window.SCN({addP,addV,jit,clamp,gs,TAU});
// PTB-XL 기록 디코드
const PT=window.PTBXL||{};
Object.keys(PT).forEach(k=>{const r=PT[k],b=atob(r.d),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);r.x=new Int16Array(u.buffer);});
function realStep(s){
  const R=sim.real,o=sim.sc.real||{},B=R.beats;
  for(let i=0;i<B.length;i++){
    const b=B[i],nx=i+1<B.length?B[i+1][0]:R.dur+B[0][0],pv=i>0?B[i-1][0]:B[B.length-1][0]-R.dur,rr=nx-b[0],prr=b[0]-pv,pvc=b[1]===1;
    addV(s.t+b[0],{rr:clamp(rr,.25,1.6),end:clamp(b[2],.07,.2),mech:pvc?.3:(o.mechRR?clamp((prr-.18)/.34,.35,1):(o.mech||1)),
      org:pvc?'rv':(o.org||'his'),lvD:pvc?.06:(o.lvD||0),rvD:pvc?0:(o.rvD||0),real:1});
    if(o.retro)addP(s.t+b[0]+.075,{kind:'retro',amp:-.7});
  }
  for(const p of R.pw)addP(s.t+p[0],{blocked:!!p[1],pr:p[2]||.16});
  s.t+=R.dur;
}
const lead=new Float32Array(12);
function ecgAt(t){
  if(sim.src==='real'){
    const R=sim.real,n=R.n,x=R.x;let f=((t-sim.r0)%R.dur+R.dur)%R.dur*100,i=Math.floor(f);f-=i;
    const i0=(i-1+n)%n,i1=i%n,i2=(i+1)%n,i3=(i+2)%n;
    for(let L=0;L<12;L++){const o=L*n,a=x[o+i0],b=x[o+i1],c=x[o+i2],d=x[o+i3];
      lead[L]=(b+.5*f*(c-a+f*(2*a-5*b+4*c-d+f*(3*(b-c)+d-a))))/200;}
    return;
  }
  const b=sim.sc.base?sim.sc.base(t):null;dip[0]=b?b[0]:0;dip[1]=b?b[1]:0;dip[2]=b?b[2]:0;
  for(let i=sim.V.length-1;i>=0;i--){const e=sim.V[i],tau=t-e.t;if(tau>.9)break;if(tau<-.05)continue;addWave(e,tau);}
  for(let i=sim.P.length-1;i>=0;i--){const e=sim.P[i],tau=t-e.t;if(tau>.3)break;if(tau<-.05)continue;const k=e.amp*gs(tau,.05,.021);dip[0]+=.07*k;dip[1]+=.11*k;dip[2]+=.02*k;}
  const nz=.006*Math.sin(t*311.7),wd=.012*Math.sin(TAU*.21*t);
  for(let L=0;L<12;L++)lead[L]=LM[L][0]*dip[0]+LM[L][1]*dip[1]+LM[L][2]*dip[2]+nz*(1+.3*Math.sin(L*1.7))+wd;
}

/* ───────────── 3. 3D 장면 ───────────── */
const V3=THREE.Vector3,HM=window.HEART,LD=HM.land.L;
const v3=a=>new V3(a[0],a[1],a[2]);
const view=$('view'),glc=$('gl');
const renderer=new THREE.WebGLRenderer({canvas:glc,antialias:true,powerPreference:'high-performance'});
const PRMAX=Math.min(devicePixelRatio||1,3);renderer.setPixelRatio(PRMAX);renderer.localClippingEnabled=true;
const scene=new THREE.Scene();
{const c=document.createElement('canvas');c.width=16;c.height=256;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,0,256);
 g.addColorStop(0,'#0b1826');g.addColorStop(.55,'#070e18');g.addColorStop(1,'#04070c');x.fillStyle=g;x.fillRect(0,0,16,256);scene.background=new THREE.CanvasTexture(c);}
const camera=new THREE.PerspectiveCamera(30,1,.1,60);
const TARGET=new V3(.12,.38,-.1);camera.position.set(1.2,.9,11);
const controls=new THREE.OrbitControls(camera,glc);controls.target.copy(TARGET);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=3;controls.maxDistance=20;controls.update();
let userMoved=false;controls.addEventListener('start',()=>{userMoved=true;});
scene.add(new THREE.HemisphereLight(0xcfe4ff,0x1a1014,.55));
const key=new THREE.DirectionalLight(0xfff1e6,.68);key.position.set(-2.5,3.5,6);scene.add(key);
const rim=new THREE.DirectionalLight(0x58c8ff,.55);rim.position.set(3,1.5,-5);scene.add(rim);
// 반사 환경(젖은 조직 질감용)
let envTex=null;
try{const es=new THREE.Scene();es.add(new THREE.Mesh(new THREE.SphereGeometry(20,24,16),new THREE.MeshBasicMaterial({color:0x101a26,side:THREE.BackSide})));
  const pan=(c,x,y,z,w,h)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);es.add(m);};
  pan(0xffffff,-6,9,7,9,5);pan(0x9fdcff,10,2,-6,5,9);pan(0xffd9c2,2,-9,6,8,4);pan(0x5a7fa8,-10,0,-4,5,8);
  const pm=new THREE.PMREMGenerator(renderer);envTex=pm.fromScene(es,.03).texture;pm.dispose();}catch(e){envTex=null;}

const heart=new THREE.Group();scene.add(heart);
const clip=new THREE.Plane(new V3(0,0,-1),9);

/* 방별 가중치와 수축 변형 (GPU 셰이더와 동일한 식을 CPU에도 둠) */
const cav=v3(LD.c_av),nav=v3(LD.n_av),dav=cav.dot(nav),civ=v3(LD.c_iv),niv=v3(LD.n_iv),cia=v3(LD.c_ia),nia=v3(LD.n_ia);
const MVc=v3(LD.MVc),TVc=v3(LD.TVc),PVc=v3(LD.PVc),AOc=v3(LD.AOc),nAo=v3(LD.n_ao),nPv=v3(LD.n_pv),LAc=v3(LD.LAc),RAc=v3(LD.RAc);
const uLV=v3(LD.u_lv),uRV=v3(LD.u_rv),LLV=LD.Llv+.18,LRV=LD.Lrv+.12;
const aoA=AOc.clone().addScaledVector(nAo,-.3),aoB=AOc.clone().addScaledVector(nAo,.9),paA=PVc.clone().addScaledVector(nPv,-.05),paB=PVc.clone().addScaledVector(nPv,.8);
function dSeg(x,y,z,a,b){const bx=b.x-a.x,by=b.y-a.y,bz=b.z-a.z,px=x-a.x,py=y-a.y,pz=z-a.z;const t=clamp((px*bx+py*by+pz*bz)/(bx*bx+by*by+bz*bz),0,1);return Math.hypot(px-bx*t,py-by*t,pz-bz*t);}
const wt=[0,0,0,0];
function wOf(x,y,z){
  const sav=x*nav.x+y*nav.y+z*nav.z-dav,vent=ss(-.12,.18,sav);
  const lvf=ss(-.1,.1,(x-civ.x)*niv.x+(y-civ.y)*niv.y+(z-civ.z)*niv.z+.12);
  const atr=(1-vent)*ss(.34,.6,dSeg(x,y,z,aoA,aoB))*ss(.3,.55,dSeg(x,y,z,paA,paB));
  const laf=ss(-.1,.1,(x-cia.x)*nia.x+(y-cia.y)*nia.y+(z-cia.z)*nia.z);
  wt[0]=vent*lvf;wt[1]=vent*(1-lvf);wt[2]=atr*laf;wt[3]=atr*(1-laf);return wt;
}
const SU={uC:{value:[0,0,0,0]},uB:{value:[MVc,TVc]},uU:{value:[uLV,uRV]},uL:{value:[LLV,LRV]},uA:{value:[LAc,RAc]},
  uAV:{value:new THREE.Vector4(nav.x,nav.y,nav.z,dav)},uQv:{value:new THREE.Vector2()},uT:{value:0},uIsc:{value:new THREE.Vector4(0,0,0,0)},uIscK:{value:.95},uDil:{value:0},uHcm:{value:0},uSep:{value:new THREE.Vector3(1,0,0)},uHole:{value:new THREE.Vector4(0,0,0,0)},
  uOrg:{value:[new V3(),new V3(),new V3(),new V3()]},uWave:{value:[-9,-9,-9,-9]},uPlat:{value:[0,0,0,0]},uChaos:{value:[0,0,0,0]},
  uHi:{value:new THREE.Vector4()},uDbg:{value:DBG==='w'?1:0},uGlow:{value:1},uDig:{value:0},uFlu:{value:0},uPulse:{value:0},uHi2:{value:new THREE.Vector4()},uEcho:{value:0},uEchoFlip:{value:0}};
const VS_DECL=`
attribute vec4 aW;
uniform float uC[4];uniform vec3 uB[2];uniform vec3 uU[2];uniform float uL[2];uniform vec3 uA[2];uniform vec4 uAV;uniform vec2 uQv;uniform float uT;uniform vec4 uIsc;uniform float uIscK;uniform float uEndo;uniform float uDil;uniform float uHcm;uniform vec3 uSep;
varying vec3 vP;varying vec4 vW;
vec3 hdeform(vec3 p,vec4 w,vec3 n){
  vec3 d=vec3(0.);
  float isc=uIsc.w>0.?1.-smoothstep(uIsc.w*.55,uIsc.w,distance(p,uIsc.xyz)):0.;
  for(int k=0;k<2;k++){
    float c=uC[k]*(1.-uIscK*isc);
    vec3 rel=p-uB[k];float s=dot(rel,uU[k]);vec3 rv=rel-s*uU[k];
    float en=uEndo<0.?0.:max(uEndo,smoothstep(-.35,.35,-dot(n,normalize(rv+vec3(1e-4)))));
    if(k==0){float ax=clamp(s/uL[0],0.,1.);rv*=1.+uDil*smoothstep(0.,.35,ax);
      float sw=smoothstep(.2,.85,dot(normalize(rv+vec3(1e-4)),uSep));}
    float kr=mix(.06,.27,en);
    float a=.2*c*clamp(s/uL[k],0.,1.);
    vec3 r2=rv*(1.-kr*c);r2=r2*cos(a)+cross(uU[k],r2)*sin(a);
    float s2=s+(uL[k]-s)*.12*c;
    d+=(k==0?w.x:w.y)*(uB[k]+uU[k]*s2+r2-p);
  }
  if(uHcm>0.){vec3 rl=p-uB[0];float s0=dot(rl,uU[0]);vec3 r0=rl-s0*uU[0];vec3 r0n=normalize(r0+vec3(1e-4));float ax0=clamp(s0/uL[0],0.,1.);
    float sw=smoothstep(.15,.8,dot(r0n,uSep)),fc=smoothstep(.05,.45,dot(n,-r0n));d+=-r0n*uHcm*.27*sw*fc*smoothstep(.02,.22,ax0)*(1.-smoothstep(.7,.95,ax0))*(1.-.35*uC[0]);}
  float fo=(1.-smoothstep(0.,1.3,-(dot(p,uAV.xyz)-uAV.w)))*.8;
  d+=w.z*(-(p-uA[0])*.11*uC[2]+uU[0]*uL[0]*.12*uC[0]*fo);
  d+=w.w*(-(p-uA[1])*.11*uC[3]+uU[1]*uL[1]*.12*uC[1]*fo);
  float q=(w.x+w.y)*uQv.x+(w.z+w.w)*uQv.y;
  d+=n*q*(.034*(sin(p.x*7.+uT*37.)*sin(p.y*6.-uT*29.)+sin(p.z*8.+uT*43.))+.02*sin(p.x*2.3+p.z*1.7+uT*19.)*sin(uT*7.+p.y*3.));
  return p+d;
}`;
const FS_DECL=`
uniform vec4 uHole;uniform vec3 uOrg[4];uniform float uWave[4];uniform float uPlat[4];uniform float uChaos[4];uniform float uT;uniform float uOp;uniform vec4 uHi;uniform vec4 uIsc;uniform float uDbg;uniform float uGlow;uniform vec4 uDye;uniform float uStop;uniform vec4 uJo;uniform vec3 uTint;uniform float uDig;uniform float uFlu;uniform float uPulse;uniform float uCorF;uniform vec4 uHi2;uniform float uVes;
varying vec3 vP;varying vec4 vW;`;
const FS_BODY=`#include <emissivemap_fragment>
{
  if(uHole.w>0.&&distance(vP,uHole.xyz)<uHole.w)discard;
  float gl=0.,pl=0.,ch=0.;
  for(int k=0;k<4;k++){float w=k==0?vW.x:(k==1?vW.y:(k==2?vW.z:vW.w));float dd0=distance(vP,uOrg[k]);
    gl+=w*exp(-pow((dd0-uWave[k])/.11,2.))*step(-1.,uWave[k]);
    pl+=w*(1.-smoothstep(uWave[k]-.12,uWave[k],dd0))*uPlat[k];
    ch+=w*uChaos[k];}
  float cn=smoothstep(.2,.7,sin(vP.x*9.+uT*23.)*sin(vP.y*8.-uT*17.)+.6*sin(vP.z*11.+uT*29.)*sin(vP.y*5.+uT*13.));
  float fres=pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),2.2);
  float ndv=clamp(abs(dot(normalize(normal),normalize(vViewPosition))),0.,1.);
  if(uVes>.5){diffuseColor.rgb*=mix(.42,1.22,pow(ndv,.75));totalEmissiveRadiance+=vec3(1.,.95,.9)*(pow(ndv,26.)*.2+pow(ndv,4.)*.05);}
  float di=distance(vP,uIsc.xyz);
  float isc=uIsc.w>0.?1.-smoothstep(uIsc.w*.55,uIsc.w,di):0.;
  float ws=vW.x+vW.y+vW.z+vW.w,wv=vW.x+vW.y;
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.17,.14,.34),isc*.88*wv);
  diffuseColor.rgb*=mix(vec3(1.),vec3(1.1,.84,.82),vW.z+vW.w);
  float rimI=uIsc.w>0.?exp(-pow((di-uIsc.w*.8)/.07,2.))*wv:0.;
  float a=uOp>.985?1.:mix(uOp,1.,fres*.82);
  if(uDig>.5){
    vec3 pc=(vW.x*vec3(1.,.34,.28)+vW.y*vec3(.22,.5,1.)+vW.z*vec3(1.,.5,.72)+vW.w*vec3(.25,.8,.95))/max(ws,1e-3);
    vec3 base=ws>.05?pc:uTint;base=mix(base,vec3(.4,.2,.65),isc*.8*wv);
    float gr=step(.93,fract(vP.y*6.))*.3;
    diffuseColor.rgb=base*.2;totalEmissiveRadiance+=base*(.22+1.1*fres+gr);
    a=uOp>.985?1.:mix(uOp*.5,1.,fres);
  }
  float e=(gl*1.15+pl*.1+ch*cn*.6)*uGlow;
  float jd=distance(vP,uJo.xyz);float jet=uJo.w>0.?exp(-pow((jd-uJo.w)/.32,2.)):0.;
  float dd=distance(vP,uDye.xyz);float fill=uDye.w>0.?(1.-smoothstep(uDye.w-.18,uDye.w,dd))*step(dd,uStop):0.;
  totalEmissiveRadiance+=vec3(.8,1.,.16)*e+vec3(1.,.5,.12)*dot(vW,uHi2)*(.05+.45*fres)*(.55+.45*uPulse)+vec3(.2,.75,.95)*dot(vW,uHi)*(.1+.55*fres)+diffuseColor.rgb*fres*.14
    +vec3(1.,.12,.18)*rimI*(.35+.8*uPulse)+diffuseColor.rgb*jet*.45+vec3(.8,.95,1.)*fill*.9;
  diffuseColor.a=min(1.,a+gl*.4+pl*.06+ch*cn*.3+rimI*.6+jet*.15+isc*wv*.25);
  if(uFlu>.5){
    totalEmissiveRadiance=vec3(0.);
    if(uCorF>.5){diffuseColor.rgb=vec3(.02);diffuseColor.a=fill;}
    else{diffuseColor.rgb=vec3(.3,.31,.33);diffuseColor.a=.04+.3*fres;}
  }
  if(uDbg>.5){diffuseColor.rgb=vW.xyz+vW.w*vec3(1.,1.,0.);diffuseColor.a=1.;}
}`;
function inject(mat,opt){
  opt=opt||{};const own={uOp:opt.op||{value:1},uEndo:{value:opt.epi?-1:(opt.endo?1:0)},uDye:{value:new THREE.Vector4()},uStop:{value:99},uJo:{value:new THREE.Vector4(0,0,0,-1)},uTint:{value:new V3(mat.color.r,mat.color.g,mat.color.b)},uCorF:{value:opt.cor?1:0},uVes:{value:opt.ves?1:0},uEchoI:{value:opt.valve?1.:(opt.lit===false?.9:.78)},uEchoBS:{value:mat.side===THREE.BackSide?1:0}};
  if(opt.valve)Object.assign(own,{uVc:{value:opt.valve.c},uVu:{value:opt.valve.u},uVo:opt.valve.o,uVm:{value:opt.valve.m}});
  mat.userData.own=own;
  mat.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,SU,own);
    let vs=sh.vertexShader.replace('#include <common>','#include <common>\n'+VS_DECL+(opt.valve?'\nuniform vec3 uVc;uniform vec3 uVu;uniform float uVo;uniform float uVm;':''));
    let body='vec3 transformed=hdeform(position,aW,normal);vP=position;vW=aW;';
    if(opt.valve)body+='{vec3 rl=transformed-uVc;float dp=dot(rl,uVu);vec3 rr=rl-dp*uVu;float pf=uVm>.5?1.:smoothstep(0.,.16,dp)*(1.-smoothstep(.3,.62,dp));transformed+=uVm>.5?rr*uVo*.16:-rr*(1.-uVo)*.5*pf;}';
    sh.vertexShader=vs.replace('#include <begin_vertex>',body);
    if(opt.lit!==false)sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\n'+FS_DECL).replace('#include <emissivemap_fragment>',FS_BODY);
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uEcho;uniform float uEchoI;uniform float uEchoBS;').replace('#include <dithering_fragment>','#include <dithering_fragment>\n  if(uEcho>.5){float ff=gl_FrontFacing?1.:0.;float isT=uEchoBS>.5?ff:1.-ff;gl_FragColor=vec4(vec3(isT*uEchoI),1.);}');
  };
  mat.customProgramCacheKey=()=>'h'+(opt.valve?1:0)+(opt.lit===false?0:1);
  return mat;
}
// CPU 쪽 변형 (전도 펄스, 표지 위치용. 심내막 기준)
const _r=new V3(),_c=new V3();
function deformPt(p,out){
  const w=wOf(p.x,p.y,p.z),w0=w[0],w1=w[1],w2=w[2],w3=w[3],C=SU.uC.value;let dx=0,dy=0,dz=0;
  for(let k=0;k<2;k++){const B=k?TVc:MVc,U=k?uRV:uLV,L=k?LRV:LLV,c=C[k],wk=k?w1:w0;if(wk<.001)continue;
    _r.copy(p).sub(B);const s=_r.dot(U);_r.addScaledVector(U,-s);const a=.2*c*clamp(s/L,0,1);
    _c.crossVectors(U,_r);const f=1-.27*c,ca=Math.cos(a)*f,sa=Math.sin(a)*f,s2=s+(L-s)*.12*c;
    dx+=wk*(B.x+U.x*s2+_r.x*ca+_c.x*sa-p.x);dy+=wk*(B.y+U.y*s2+_r.y*ca+_c.y*sa-p.y);dz+=wk*(B.z+U.z*s2+_r.z*ca+_c.z*sa-p.z);}
  const fo=(1-ss(0,1.3,-(p.dot(nav)-dav)))*.8;
  dx+=w2*(-(p.x-LAc.x)*.11*C[2]+uLV.x*LLV*.12*C[0]*fo)+w3*(-(p.x-RAc.x)*.11*C[3]+uRV.x*LRV*.12*C[1]*fo);
  dy+=w2*(-(p.y-LAc.y)*.11*C[2]+uLV.y*LLV*.12*C[0]*fo)+w3*(-(p.y-RAc.y)*.11*C[3]+uRV.y*LRV*.12*C[1]*fo);
  dz+=w2*(-(p.z-LAc.z)*.11*C[2]+uLV.z*LLV*.12*C[0]*fo)+w3*(-(p.z-RAc.z)*.11*C[3]+uRV.z*LRV*.12*C[1]*fo);
  return out.set(p.x+dx,p.y+dy,p.z+dz);
}
function addW(g){const p=g.attributes.position,a=new Float32Array(p.count*4);
  for(let i=0;i<p.count;i++){const w=wOf(p.getX(i),p.getY(i),p.getZ(i));a[i*4]=w[0];a[i*4+1]=w[1];a[i*4+2]=w[2];a[i*4+3]=w[3];}
  g.setAttribute('aW',new THREE.BufferAttribute(a,4));return g;}
function b64(s){const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u.buffer;}
function partGeo(name,noW){const P=HM.parts[name],i16=new Int16Array(b64(P.p)),pos=new Float32Array(i16.length);
  for(let i=0;i<i16.length;i++)pos[i]=i16[i]/HM.q;
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  g.setIndex(new THREE.BufferAttribute(P.w===2?new Uint16Array(b64(P.i)):new Uint32Array(b64(P.i)),1));g.computeVertexNormals();
  if(noW)g.setAttribute('aW',new THREE.BufferAttribute(new Float32Array(pos.length/3*4),4));else addW(g);return g;}

const opWall={value:.28},opVes={value:.28};
const transMats=[],pickables=[];
function std(color,o){o=o||{};const m=new THREE.MeshStandardMaterial({color,roughness:o.rough==null?.42:o.rough,metalness:.02,envMap:envTex,envMapIntensity:o.env==null?.55:o.env,side:o.side==null?THREE.DoubleSide:o.side,transparent:!!o.trans,depthWrite:!o.trans});
  if(o.clip!==false)m.clippingPlanes=[clip];return m;}
function addMesh(g,mat,key,order){const m=new THREE.Mesh(g,mat);m.renderOrder=order;m.userData.pick=key;m.frustumCulled=false;heart.add(m);if(key)pickables.push(m);return m;}
// 심근: 뒷면 → 앞면 순서로 두 번 그려 반투명 품질을 높임
const gWall=partGeo('wall');
const mWB=inject(std(0xb23338,{trans:true,side:THREE.BackSide}),{op:opWall}),mWF=inject(std(0xb83a3c,{trans:true,side:THREE.FrontSide}),{op:opWall});
transMats.push([mWB,opWall],[mWF,opWall]);
const wallB=addMesh(gWall,mWB,null,5),wallF=addMesh(gWall,mWF,'wall',7);
// 내부 구조
const vOpen={mv:{value:1},tv:{value:1},pv:{value:0}};
const inner=[];
inner.push(addMesh(partGeo('pap'),inject(std(0x7f4a42,{rough:.9,env:.04}),{lit:false}),'pap',2));
// 관상동맥·정맥
const corMats={};
const cors=['rca','lad','lcx'].map(k=>{corMats[k]=inject(std(0xff7d5e,{rough:.22,env:1.1,trans:true}),{cor:1,ves:1,epi:1});corMats[k].depthWrite=true;return addMesh(partGeo(k),corMats[k],k,3);});
cors.push(addMesh(partGeo('cvn'),inject(std(0x4d7bd6,{rough:.22,env:1.1}),{ves:1,epi:1}),'cvn',3));
// 대혈관
const vessels=[['ao',0xd9453c],['pa',0x4a6fe0],['pvn',0xe3695f],['svc',0x3c60c8],['ivc',0x3c60c8]].map(([k,c])=>{
  const m=inject(std(c,{trans:true,rough:.3,env:.9}),{op:opVes,ves:1});transMats.push([m,opVes]);return addMesh(partGeo(k,true),m,k,6);});
// ── 판막: 절차적 판엽·판륜·건삭. 판륜 위치·크기는 해부 계측값, 매 프레임 심실 수축 변형(deformPt)을 따라감 ──
const papM=inner[0],VALVES=[];
const vPerp=(v,u)=>v.clone().addScaledVector(u,-v.dot(u)).normalize();
function papTips(lvSide){const pp=papM.geometry.attributes.position,aw=papM.geometry.attributes.aW,c=lvSide?MVc:TVc,u=lvSide?uLV:uRV,e2=v3(lvSide?LD.e2l:LD.e2r),G=[[],[]];
  for(let i=0;i<pp.count;i++){const w=aw.getX(i),wr=aw.getY(i);if(lvSide?w<.5:(wr<.5||w>.5))continue;const p=new V3(pp.getX(i),pp.getY(i),pp.getZ(i)),d=p.clone().sub(c);G[d.dot(e2)>0?0:1].push([d.dot(u),p]);}
  return G.map((g,k)=>{if(g.length<20)return c.clone().addScaledVector(u,(lvSide?LLV:LRV)*.5).addScaledVector(e2,k?-.3:.3);g.sort((x,y)=>x[0]-y[0]);const n=Math.max(8,Math.floor(g.length*.1)),s=new V3();for(let q=0;q<n;q++)s.add(g[q][1]);return s.divideScalar(n);});}
function mkValve(o){
  const u=o.u.clone().normalize(),e1=vPerp(o.e1,u),e2=new V3().crossVectors(u,e1),r=o.r,sl=o.type==='sl',NS=o.ns||16,NT=9,hC=.55*r;
  const g=new THREE.Group();heart.add(g);inner.push(g);
  const leafMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.58,metalness:0,side:THREE.DoubleSide,envMap:envTex,envMapIntensity:.22,clippingPlanes:[clip],emissive:0x000000});
  const annMat=new THREE.MeshStandardMaterial({color:0xe6cf9e,roughness:.5,envMap:envTex,envMapIntensity:.5,clippingPlanes:[clip],emissive:0x000000});
  const rad=th=>e1.clone().multiplyScalar(Math.cos(th)).addScaledVector(e2,Math.sin(th));
  const rAt=th=>o.shape==='mv'?r*(1-.16*Math.pow(Math.max(0,Math.cos(th)),3)):r;
  const zAt=(th,s)=>sl?hC*(1-Math.sin(Math.PI*s)):(o.shape==='mv'?-.13*r*Math.cos(2*th):-.06*r*Math.cos(3*th));
  const leaves=o.leaf.map(([a0,a1,len,sc])=>{const n=NS+1,m=NT+1,pos=new Float32Array(n*m*3),col=new Float32Array(n*m*3),idx=[];
    for(let i=0;i<NS;i++)for(let j=0;j<NT;j++){const p=i*m+j,q=(i+1)*m+j;idx.push(p,q,p+1,q,q+1,p+1);}
    for(let i=0;i<n;i++)for(let j=0;j<m;j++){const s=i/NS,t=j/NT,k=(i*m+j)*3,ed=ss(.7,1,t),an=1-ss(0,.16,t),c0=o.col;
      let R=c0[0]+(1-c0[0])*ed*.5+(.92-c0[0])*an*.35,G=c0[1]+(.95-c0[1])*ed*.5+(.8-c0[1])*an*.35,B=c0[2]+(.9-c0[2])*ed*.5+(.55-c0[2])*an*.35;
      if(sl){const nd=Math.exp(-((s-.5)*(s-.5)/.006+(t-1)*(t-1)/.012));R+=nd*.18;G+=nd*.15;B+=nd*.1;}
      col[k]=R;col[k+1]=G;col[k+2]=B;}
    const ge=new THREE.BufferGeometry();ge.setAttribute('position',new THREE.BufferAttribute(pos,3));ge.setAttribute('color',new THREE.BufferAttribute(col,3));ge.setIndex(idx);
    const mesh=new THREE.Mesh(ge,leafMat);mesh.userData.pick=o.key;mesh.renderOrder=2;mesh.frustumCulled=false;g.add(mesh);pickables.push(mesh);
    const lenAt=s=>len*r*(sc==='scallop'?.7+.3*Math.sqrt(Math.abs(Math.sin(3*Math.PI*s))):.72+.28*Math.sqrt(Math.sin(Math.PI*s)));
    return{a0,a1,mesh,ge,pos,n,m,lenAt};});
  // 판륜 (방실판: 안장형 D자 고리 / 반월판: 왕관형 부착선)
  const ring=[];if(sl)leaves.forEach(L=>{for(let i=0;i<16;i++){const s=i/16,th=L.a0+(L.a1-L.a0)*s;ring.push(c0=>c0.clone().addScaledVector(rad(th),r).addScaledVector(u,zAt(th,s)));}});
  else for(let i=0;i<72;i++){const th=i/72*TAU;ring.push(c0=>c0.clone().addScaledVector(rad(th),rAt(th)).addScaledVector(u,zAt(th)));}
  const RS=6,NR=ring.length,tp=new Float32Array(NR*RS*3),ti=[];for(let i=0;i<NR;i++)for(let k=0;k<RS;k++){const p=i*RS+k,q=((i+1)%NR)*RS+k,p1=i*RS+(k+1)%RS,q1=((i+1)%NR)*RS+(k+1)%RS;ti.push(p,q,p1,q,q1,p1);}
  const tg=new THREE.BufferGeometry();tg.setAttribute('position',new THREE.BufferAttribute(tp,3));tg.setIndex(ti);
  const tube=new THREE.Mesh(tg,annMat);tube.userData.pick=o.key;tube.renderOrder=2;tube.frustumCulled=false;g.add(tube);pickables.push(tube);
  // 건삭: 유두근 끝 → 분지점 → 판엽 자유연(1차)·몸통(2차)
  let chord=null,anchors=[],pms=o.pms||[];
  if(pms.length){const pa=pms.map(p=>{const d=p.clone().sub(o.c);return Math.atan2(d.dot(e2),d.dot(e1));});
    leaves.forEach((L,li)=>{for(let i=1;i<NS;i+=2)for(const j of [NT,Math.round(NT*.62)]){if(j!==NT&&i%4!==1)continue;const th=L.a0+(L.a1-L.a0)*i/NS;let best=0,bd=9;pa.forEach((x,k)=>{let d=Math.abs(Math.atan2(Math.sin(th-x),Math.cos(th-x)));if(d<bd){bd=d;best=k;}});anchors.push({li,v:i*L.m+j,pm:best});}});
    const cp=new Float32Array(anchors.length*2*3*2);const cg=new THREE.BufferGeometry();cg.setAttribute('position',new THREE.BufferAttribute(cp,3));cg.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(cp.length),3));
    chord=new THREE.LineSegments(cg,new THREE.LineBasicMaterial({color:0xf3e3d3,transparent:true,opacity:.78,clippingPlanes:[clip]}));chord.renderOrder=2;chord.frustumCulled=false;g.add(chord);}
  const pmD=pms.map(p=>p.clone()),cD=new V3(),Ab=new V3(),Ad=new V3(),T=new V3(),P=new V3(),vc=new V3(),vo=new V3(),dA=new V3(),dC=new V3(),rd=new V3(),tmp=new V3();
  const lumen=null;
  const V={key:o.key,g,leaves,leafMat,annMat,open:0,u,c:o.c,lumen,tube:tg,tubeP:tp,
    upd(op,time){const c=o.c;deformPt(c,cD);dC.copy(cD).sub(c);
      for(const L of leaves){for(let i=0;i<L.n;i++){const s=i/(L.n-1),th=L.a0+(L.a1-L.a0)*s;rd.copy(rad(th));
          Ab.copy(c).addScaledVector(rd,rAt(th)).addScaledVector(u,zAt(th,s));deformPt(Ab,Ad);dA.copy(Ad).sub(Ab);
          // 닫힘 목표점 (접합선)
          if(o.shape==='mv'){const x=Math.sin(th)*r*.86,y=-.1*r+.55*r*Math.pow(Math.sin(th)/.87,2);T.copy(c).addScaledVector(e1,y).addScaledVector(e2,x).addScaledVector(u,.16*r);}
          else{const ar=s<.5?L.a0:L.a1,f=s<.5?1-2*s:2*s-1;T.copy(c).addScaledVector(rad(ar),r*.9*f).addScaledVector(u,sl?hC*.85:.18*r);}
          const ln=L.lenAt(s),fl=Math.sin(time*(sl?37:29)+th*3+s*5)*op*(1-op*.4);
          for(let j=0;j<L.m;j++){const t=j/(L.m-1),k=(i*L.m+j)*3,sp=Math.sin(Math.PI*t);
            // 닫힘
            vc.copy(T).sub(Ab).multiplyScalar(t).addScaledVector(u,sl?-r*.42*Math.pow(sp,.8)*Math.sin(Math.PI*s):-r*.22*sp*Math.sin(Math.PI*s));
            vc.addScaledVector(u,sl?r*.28*ss(.68,1,t):r*.1*ss(.75,1,t));
            // 열림
            if(sl){tmp.copy(c).addScaledVector(rd,r*.88).addScaledVector(u,hC+.12*r).sub(Ab);vo.copy(tmp).multiplyScalar(t).addScaledVector(rd,-r*.1*sp*Math.sin(Math.PI*s)+r*.02*fl*t);}
            else{vo.copy(u).multiplyScalar(t*ln).addScaledVector(rd,-t*ln*.06+ln*.08*sp+r*.035*fl*t);}
            const lc=vc.length(),lo=vo.length(),ll=lc+(lo-lc)*op;P.copy(vc).lerp(vo,op);const pl=P.length();if(pl>1e-6)P.multiplyScalar(ll/pl);
            P.add(Ab).addScaledVector(dA,1-t).addScaledVector(dC,t);L.pos[k]=P.x;L.pos[k+1]=P.y;L.pos[k+2]=P.z;}}
        L.ge.attributes.position.needsUpdate=true;L.ge.computeVertexNormals();L.ge.computeBoundingSphere();}
      // 판륜 관
      for(let i=0;i<NR;i++){Ab.copy(ring[i](c));deformPt(Ab,Ad);const nx=ring[(i+1)%NR](c),pv=ring[(i-1+NR)%NR](c);tmp.copy(nx).sub(pv).normalize();
        rd.copy(Ab).sub(c);rd.addScaledVector(u,-rd.dot(u)).normalize();const bn=new V3().crossVectors(tmp,rd).normalize(),tr=sl?.016:.024;
        for(let k=0;k<RS;k++){const an=k/RS*TAU;P.copy(Ad).addScaledVector(rd,Math.cos(an)*tr).addScaledVector(bn,Math.sin(an)*tr);tp.set([P.x,P.y,P.z],(i*RS+k)*3);}}
      tg.attributes.position.needsUpdate=true;tg.computeVertexNormals();tg.computeBoundingSphere();
      // 상태 발광: 열림 초록 / 닫힘 호박색 (기존 개폐 고리 역할)
      annMat.emissive.setRGB(.42-.36*op,.22+.2*op,.06+.06*op);leafMat.emissive.setRGB(.1,.045,.035);
      if(chord){pms.forEach((p,k)=>deformPt(p,pmD[k]));const cp=chord.geometry.attributes.position.array;let w=0;
        for(const A of anchors){const L=leaves[A.li],q=A.v*3,pm=pmD[A.pm];tmp.set(L.pos[q],L.pos[q+1],L.pos[q+2]);P.copy(pm).lerp(tmp,.55).addScaledVector(u,-.02);
          cp.set([pm.x,pm.y,pm.z,P.x,P.y,P.z,P.x,P.y,P.z,tmp.x,tmp.y,tmp.z],w);w+=12;}
        chord.geometry.attributes.position.needsUpdate=true;}}};
  VALVES.push(V);V.upd(0,0);return V;}
const d60=Math.PI/180;
const vMV=mkValve({key:'mv',c:MVc,u:uLV,e1:AOc.clone().sub(MVc),r:.36,shape:'mv',col:[.9,.62,.56],ns:18,
  leaf:[[-62*d60,62*d60,1.45,'round'],[62*d60,298*d60,.95,'scallop']],pms:papTips(true)});
const tvSept=MVc.clone().sub(TVc);
const vTV=mkValve({key:'tv',c:TVc,u:uRV,e1:tvSept,r:.38,col:[.88,.63,.6],
  leaf:[[-60*d60,60*d60,1.05,'round'],[60*d60,200*d60,1.2,'round'],[200*d60,300*d60,.95,'round']],
  pms:papTips(false).concat([TVc.clone().addScaledVector(uRV,LRV*.36).addScaledVector(vPerp(tvSept,uRV),.3)])});
const vAV=mkValve({key:'av',c:AOc.clone().addScaledVector(nAo,.02),u:nAo,e1:MVc.clone().sub(AOc),r:.3,type:'sl',col:[.93,.76,.66],ns:14,
  leaf:[[0,120*d60],[120*d60,240*d60],[240*d60,360*d60]]});
const vPV=mkValve({key:'pv',c:PVc.clone().addScaledVector(nPv,-.04),u:nPv,e1:AOc.clone().sub(PVc),r:.28,type:'sl',col:[.9,.74,.7],ns:14,
  leaf:[[30*d60,150*d60],[150*d60,270*d60],[270*d60,390*d60]]});
const aoValve={g:vAV.g,open:0,set(t,dt){this.open+=(t-this.open)*Math.min(1,dt*28);}};
// 폐색 표지
const occMat=new THREE.MeshBasicMaterial({color:0x05070a});
const occLAD=new THREE.Mesh(new THREE.SphereGeometry(.07,14,10),occMat),occRCA=occLAD.clone();
occLAD.position.copy(v3(LD.ladOcc));occRCA.position.copy(v3(LD.rcaOcc));heart.add(occLAD,occRCA);
const ringG=new THREE.TorusGeometry(.12,.012,8,28),ringM=new THREE.MeshBasicMaterial({color:0xff4d5a});
[occLAD,occRCA].forEach(o=>{const r=new THREE.Mesh(ringG,ringM);o.add(r);o.userData.ring=r;});

/* 전도계 */
const CD=HM.land.C,cond=[],condRoots=[];
function condPath(key,pts,r){
  const curve=new THREE.CatmullRomCurve3(pts.map(v3)),g=addW(new THREE.TubeGeometry(curve,pts.length*7,r,7,false));
  const mat=inject(new THREE.MeshBasicMaterial({color:0x6b5c1e,clippingPlanes:[clip]}),{lit:false,endo:1});
  const m=new THREE.Mesh(g,mat);m.renderOrder=3;m.frustumCulled=false;m.userData.pick=key;heart.add(m);pickables.push(m);
  const dot=new THREE.Mesh(dotG,dotM);dot.visible=false;dot.renderOrder=9;heart.add(dot);condRoots.push(m,dot);
  const o={key,curve,mat,dot,lit:0};cond.push(o);return o;
}
const dotG=new THREE.SphereGeometry(.045,12,10),dotM=new THREE.MeshBasicMaterial({color:0xcfe64a,clippingPlanes:[clip]});
const RAD={inod:.014,bach:.014,his:.024,lbb:.02,rbb:.02,purkL:.012,purkR:.012};
Object.keys(CD).forEach(k=>CD[k].forEach(p=>{if(p.length>=2)condPath(k,p,RAD[k]);}));
const SAp=v3(LD.SA),AVp=v3(LD.AVn);
const mkNode=(p,r,key)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(r,18,14),new THREE.MeshBasicMaterial({color:0x8a7a2a,clippingPlanes:[clip]}));m.position.copy(p);m.renderOrder=9;m.userData.pick=key;m.userData.base=p.clone();heart.add(m);pickables.push(m);condRoots.push(m);return m;};
const saNode=mkNode(SAp,.085,'sa'),avNode=mkNode(AVp,.075,'avn');
const blkM=new THREE.MeshBasicMaterial({color:0xff3b4a,clippingPlanes:[clip]});
const blkL=new THREE.Mesh(new THREE.OctahedronGeometry(.085),blkM),blkR=blkL.clone();
blkL.userData.base=v3(CD.lbb[0][1]);blkR.userData.base=v3(CD.rbb[0][2]);heart.add(blkL,blkR);condRoots.push(blkL,blkR);
const loopM=new THREE.MeshBasicMaterial({color:0xffb347,clippingPlanes:[clip]});
const flLoop=new THREE.Group();flLoop.position.copy(TVc).addScaledVector(nav,-.22);flLoop.quaternion.setFromUnitVectors(new V3(0,0,1),nav);heart.add(flLoop);
flLoop.add(new THREE.Mesh(new THREE.TorusGeometry(.5,.014,8,56),loopM));const flDot=new THREE.Mesh(dotG,dotM);flLoop.add(flDot);
const avLoop=new THREE.Group();avLoop.position.copy(AVp);avLoop.quaternion.setFromUnitVectors(new V3(0,0,1),nia);heart.add(avLoop);
avLoop.add(new THREE.Mesh(new THREE.TorusGeometry(.13,.012,8,32),loopM));const avDot=new THREE.Mesh(new THREE.SphereGeometry(.045,10,8),dotM);avLoop.add(avDot);
const focL=new THREE.Mesh(new THREE.SphereGeometry(.11,16,12),new THREE.MeshBasicMaterial({color:0xff8a3d,transparent:true,clippingPlanes:[clip]})),focR=new THREE.Mesh(focL.geometry,focL.material.clone());
focL.userData.base=v3(LD.lvFoc);focR.userData.base=v3(LD.rvFoc);heart.add(focL,focR);condRoots.push(flLoop,avLoop,focL,focR);
const ORG={lvN:v3(LD.lvN),lvSept:v3(LD.lvSept),lvFoc:v3(LD.lvFoc),rvN:v3(LD.rvN),rvSept:v3(LD.rvSept),rvFoc:v3(LD.rvFoc),ra:SAp,la:v3(CD.bach[0][2]),avn:AVp};

/* 혈류 입자 (머리 + 꼬리 선분, 가산 혼합) */
const paths=[];
const inV=p=>Math.abs(p[0]-.1)<1.15&&p[1]<2.3&&p[1]>-1.7;
['L','R'].forEach((s,si)=>HM.land.F[s].forEach(f0=>{let a0=0,a1=f0.p.length;while(a0<2&&!inV(f0.p[a0]))a0++;while(a1-1>f0.g[3]+1&&!inV(f0.p[a1-1]))a1--;
  const f={p:f0.p.slice(a0,a1),r:f0.r.slice(a0,a1),g:f0.g.map(x=>Math.max(0,x-a0))};const n=f.p.length-1;paths.push({curve:new THREE.CatmullRomCurve3(f.p.map(v3)),rad:f.r,n,a:f.g[0]/n,g1:f.g[1]/n,ap:f.g[2]/n,g2:f.g[3]/n,side:si,src:si});}));
const nL=HM.land.F.L.length,nR=HM.land.F.R.length;
const NP=1500,pU=new Float32Array(NP),pPath=new Uint8Array(NP),pOff=new Float32Array(NP*3),pRnd=new Float32Array(NP),pPrev=new Float32Array(NP*3);
const hPos=new Float32Array(NP*3),hCol=new Float32Array(NP*3),lPos=new Float32Array(NP*6),lCol=new Float32Array(NP*6);
let shuntOn=null;const pick=side=>{if(shuntOn){const c=paths.findIndex(p=>p.sh===shuntOn&&p.src===side);if(c>=0&&Math.random()<.45)return c;}return side?nL+((Math.random()*nR)|0):(Math.random()*nL)|0;};
for(let i=0;i<NP;i++){const side=i%2;pPath[i]=pick(side);pU[i]=Math.random();pRnd[i]=Math.random();
  const v=new V3(jit(1),jit(1),jit(1));if(v.length()>1)v.normalize().multiplyScalar(Math.random());pOff.set([v.x,v.y,v.z],i*3);
  const c=side?[.22,.45,1]:[1,.26,.16];hCol.set(c,i*3);lCol.set([c[0]*.02,c[1]*.02,c[2]*.02,c[0]*.75,c[1]*.75,c[2]*.75],i*6);}
const hGeo=new THREE.BufferGeometry();hGeo.setAttribute('position',new THREE.BufferAttribute(hPos,3));hGeo.setAttribute('color',new THREE.BufferAttribute(hCol,3));
const lGeo=new THREE.BufferGeometry();lGeo.setAttribute('position',new THREE.BufferAttribute(lPos,3));lGeo.setAttribute('color',new THREE.BufferAttribute(lCol,3));
const spr=document.createElement('canvas');spr.width=spr.height=64;{const x=spr.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.25,'rgba(255,255,255,.7)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);}
const heads=new THREE.Points(hGeo,new THREE.PointsMaterial({size:.085,map:new THREE.CanvasTexture(spr),vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true}));
const tails=new THREE.LineSegments(lGeo,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
heads.material.clippingPlanes=[clip];tails.material.clippingPlanes=[clip];heads.renderOrder=8;tails.renderOrder=8;heads.frustumCulled=tails.frustumCulled=false;heart.add(heads,tails);
const tmp=new V3();let perf=1,perfT=1,pInit=false;
function stepParticles(dt,S){
  for(let i=0;i<NP;i++){
    let P=paths[pPath[i]],u=pU[i],re=false;const s=S[P.side];
    if(u<P.a)u+=dt*P.a*(.03+.55*perf);
    else if(u<P.g1){u+=dt*(P.g1-P.a)*(.5*perf+2.2*s.fill+2.5*s.kick);if(!s.avOpen)u=Math.min(u,P.g1-.05*(1+3*pRnd[i])*(P.g1-P.a));}
    else if(u<P.ap)u+=dt*(P.ap-P.g1)*(1.25*s.fill+1.6*s.kick+.1*perf);
    else if(u<P.g2){u+=dt*(P.g2-P.ap)*(1.5*s.ej);if(!s.semiOpen)u=Math.min(u,P.g2-.03*(1+3*pRnd[i])*(P.g2-P.ap));}
    else u+=dt*((1-P.g2)*.4+.1)*(1.5*s.ej+.5*perf);
    if(u>=1){u=0;pPath[i]=pick(i%2);P=paths[pPath[i]];re=true;}
    pU[i]=u;P.curve.getPoint(u,tmp);
    const f=u*P.n,k=Math.min(P.n-1,f|0);let r=P.rad[k]*(1-(f-k))+P.rad[k+1]*(f-k);if(u>P.g1&&u<P.g2)r*=1-.3*s.c;
    const x=tmp.x+pOff[i*3]*r,y=tmp.y+pOff[i*3+1]*r,z=tmp.z+pOff[i*3+2]*r,j=i*3;
    let tx=x,ty=y,tz=z;
    if(!re&&pInit){let vx=(pPrev[j]-x),vy=(pPrev[j+1]-y),vz=(pPrev[j+2]-z);const sc=.075/dt,l=Math.hypot(vx,vy,vz)*sc,m=l>.42?.42/l:1;tx=x+vx*sc*m;ty=y+vy*sc*m;tz=z+vz*sc*m;}
    pPrev[j]=x;pPrev[j+1]=y;pPrev[j+2]=z;hPos[j]=x;hPos[j+1]=y;hPos[j+2]=z;
    lPos[i*6]=tx;lPos[i*6+1]=ty;lPos[i*6+2]=tz;lPos[i*6+3]=x;lPos[i*6+4]=y;lPos[i*6+5]=z;
  }
  pInit=true;hGeo.attributes.position.needsUpdate=true;lGeo.attributes.position.needsUpdate=true;
}

/* 후처리 (발광) */
let composer=null,bloom=null,glowOn=true;
try{
  const rt=renderer.capabilities.isWebGL2?(()=>{const r=new THREE.WebGLMultisampleRenderTarget(8,8,{format:THREE.RGBAFormat});r.samples=Math.min(8,renderer.capabilities.maxSamples||4);return r;})():undefined;
  composer=new THREE.EffectComposer(renderer,rt);composer.addPass(new THREE.RenderPass(scene,camera));
  bloom=new THREE.UnrealBloomPass(new THREE.Vector2(256,256),.28,.4,.93);composer.addPass(bloom);
}catch(e){composer=null;}

/* ───────────── 4. 생리 계산 ───────────── */
function ventState(t,right){
  let c=0,ej=false,sys=false,m=0;
  for(let i=sim.V.length-1;i>=0;i--){const e=sim.V[i],tau=t-e.t-(right?e.rvD:e.lvD);
    if(tau>1.3)break;if(tau<0)continue;
    const Ts=e.qt+.04,k=ss(.04,.04+.36*Ts,tau)*(1-ss(.62*Ts,1.12*Ts,tau))*e.mech;
    if(k>c)c=k;
    if(tau>.05&&tau<Ts){sys=true;m=Math.max(m,e.mech);if(tau>.08&&tau<.64*Ts&&e.mech>.15)ej=true;}
  }
  return{c,ej,avOpen:!(sys&&m>.05)};
}
function atrialC(t){let a=0;for(let i=sim.P.length-1;i>=0;i--){const tau=t-sim.P[i].t;if(tau>.5)break;if(tau<0)continue;a=Math.max(a,ss(.03,.1,tau)*(1-ss(.12,.24,tau)));}return a;}
function lastEv(arr,t,w0,w1,f){for(let i=arr.length-1;i>=0;i--){const e=arr[i],d=t-e.t;if(d>w1+.01&&d>1.5)break;if(d>=w0&&d<=w1&&(!f||f(e)))return e;}return null;}
function abp(t){
  const sc=sim.sc;if(!sc.vit.bp)return 16+2*Math.sin(t*.9);
  const sy=sc.vit.bp[0],di=sc.vit.bp[1],ref=sc.mref||1;let g=0;
  for(let i=sim.V.length-1;i>=0;i--){const e=sim.V[i],tau=t-e.t-.13-e.lvD;if(tau>2.5)break;if(tau<0||e.mech<.05)continue;
    const a=Math.min(1.1,e.mech/ref);g=Math.max(g,a*(tau<.09?ss(0,.09,tau):Math.exp(-(tau-.09)/.42)+.07*gs(tau,.3,.035)));}
  return di-4+(sy-di+4)*g;
}

/* ───────────── 5. 모니터 / 12유도 ───────────── */
const FS=250,NB=FS*13,buf=[];for(let i=0;i<13;i++)buf.push(new Float32Array(NB).fill(NaN));
const ecgC=$('ecg'),ecgCtx=ecgC.getContext('2d');let ex=ecgCtx;let eW=0,eH=0,dpr=1;
function sample(){
  let guard=0;const dt=1/FS;
  while(sim.n*dt<sim.t&&guard++<400){const ts=sim.n*dt,i=sim.n%NB;ecgAt(ts);for(let L=0;L<12;L++)buf[L][i]=lead[L];buf[12][i]=abp(ts);sim.n++;}
  if(sim.n*dt<sim.t)sim.n=Math.ceil(sim.t*FS);
}
function trace(b,x0,y0,w,win,k,color,lw){
  const N=Math.min(NB-2,Math.floor(win*FS)),gap=Math.floor(FS*.1),n1=sim.n-1;
  ex.strokeStyle=color;ex.lineWidth=lw;ex.beginPath();let pen=false,px=-1;
  for(let j=n1-N+gap;j<=n1;j++){if(j<0)continue;const v=b[j%NB];if(v!==v){pen=false;continue;}
    const x=x0+((j/FS)%win)/win*w,y=y0-v*k;if(pen&&x>=px)ex.lineTo(x,y);else{ex.moveTo(x,y);pen=true;}px=x;}
  ex.stroke();
}
let gridC=null,zoomL=-1;
ecgC.style.cursor='pointer';
ecgC.addEventListener('click',e=>{if(zoomL>=0){zoomL=-1;$('dock').classList.remove('zoom');return;}$('dock').classList.add('zoom');const r=ecgC.getBoundingClientRect(),c=Math.min(3,Math.floor((e.clientX-r.left)/r.width*4)),w=Math.min(2,Math.floor((e.clientY-r.top)/r.height*3));zoomL=[[0,1,2],[3,4,5],[6,7,8],[9,10,11]][c][w];});
function drawZoom(){
  ex=ecgCtx;ex.setTransform(dpr,0,0,dpr,0,0);ex.fillStyle='#04080d';ex.fillRect(0,0,eW,eH);ex.lineJoin='round';
  const win=Math.min(12,Math.max(5,eW/90)),pps=eW/win,k=Math.min(eH/3.3,.8*pps),base=eH*.58,gain=k/(.4*pps);
  ex.lineWidth=1;for(let s=0;s*.2<=win;s++){const x=Math.round(s*.2*pps)+.5;ex.strokeStyle=s%5===0?'rgba(255,110,120,.22)':'rgba(255,110,120,.09)';ex.beginPath();ex.moveTo(x,0);ex.lineTo(x,eH);ex.stroke();}
  for(let m=-6;m<=6;m++){const y=Math.round(base-m*.5*k)+.5;if(y<0||y>eH)continue;ex.strokeStyle=m%2===0?'rgba(255,110,120,.22)':'rgba(255,110,120,.09)';ex.beginPath();ex.moveTo(0,y);ex.lineTo(eW,y);ex.stroke();}
  trace(buf[zoomL],0,base,eW,win,k,'#7cf5a6',2.2);
  ex.fillStyle='#d6f5e2';ex.font='600 18px "IBM Plex Mono",monospace';ex.fillText(LEADS[zoomL],10,24);
  ex.fillStyle='#8fa3b5';ex.font='11px "IBM Plex Mono",monospace';ex.fillText((10*gain).toFixed(0)+' mm/mV · 25 mm/s · 눈금 0.2초 / 0.5 mV · 탭하면 12유도로',10,eH-8);
}
function drawMon(){
  if(zoomL>=0){drawZoom();return;}
  ex=ecgCtx;ex.setTransform(dpr,0,0,dpr,0,0);ex.fillStyle='#04080d';ex.fillRect(0,0,eW,eH);ex.lineJoin='round';
  const cols=4,rows=3,cw=eW/cols,ch=eH/rows,win=2.5,mm=Math.max(2,cw/win*.2/5),k=Math.min(10*mm,ch/3.3);
  if(!gridC||gridC.width!==ecgC.width||gridC.height!==ecgC.height){gridC=document.createElement('canvas');gridC.width=ecgC.width;gridC.height=ecgC.height;const g=gridC.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.fillStyle='#04080d';g.fillRect(0,0,eW,eH);g.lineWidth=1;
    for(let x=0;x<=eW;x+=mm){g.strokeStyle=Math.round(x/mm)%5===0?'rgba(255,110,120,.17)':'rgba(255,110,120,.07)';g.beginPath();g.moveTo(Math.round(x)+.5,0);g.lineTo(Math.round(x)+.5,eH);g.stroke();}
    for(let y=0;y<=eH;y+=mm){g.strokeStyle=Math.round(y/mm)%5===0?'rgba(255,110,120,.17)':'rgba(255,110,120,.07)';g.beginPath();g.moveTo(0,Math.round(y)+.5);g.lineTo(eW,Math.round(y)+.5);g.stroke();}}
  ex.drawImage(gridC,0,0,eW,eH);
  const ids=[[0,1,2],[3,4,5],[6,7,8],[9,10,11]];
  for(let c=0;c<cols;c++)for(let r=0;r<rows;r++){
    const L=ids[c][r],x0=c*cw,y0=r*ch,base=y0+ch*.6;
    ex.save();ex.beginPath();ex.rect(x0,y0,cw,ch);ex.clip();
    trace(buf[L],x0,base,cw,win,k,'#7cf5a6',1.8);
    ex.restore();
    ex.fillStyle='#d6f5e2';ex.font='600 13px "IBM Plex Mono",monospace';ex.fillText(LEADS[L],x0+6,y0+16);
  }
  ex.strokeStyle='rgba(120,190,220,.25)';ex.beginPath();for(let c=1;c<cols;c++){ex.moveTo(Math.round(c*cw)+.5,0);ex.lineTo(Math.round(c*cw)+.5,eH);}ex.stroke();
  ex.fillStyle='#6b8194';ex.font='11px "IBM Plex Mono",monospace';ex.fillText('10 mm/mV · 25 mm/s',eW-140,eH-6);
}
/* ───────────── 6. UI ───────────── */
const sevVar={ok:'var(--ok)',warn:'var(--warn)',crit:'var(--crit)'};
const pop=$('pop');let lastG='',gridEl=null;
SC.forEach(sc=>{
  if(sc.g!==lastG){const h=document.createElement('h3');h.textContent=sc.g;pop.appendChild(h);gridEl=document.createElement('div');gridEl.className='grid';pop.appendChild(gridEl);lastG=sc.g;}
  const b=document.createElement('button');b.type='button';b.className='sc';b.style.setProperty('--sev',sevVar[sc.sev]);
  b.innerHTML='<i class="dot"></i><span></span>'+(PT[sc.id]?'<em>실측</em>':'')+'<small></small>';b.children[1].textContent=sc.name;b.lastChild.textContent=sc.tag;
  b.addEventListener('click',()=>{setScenario(sc);togglePop(false);});gridEl.appendChild(b);sc.btn=b;
});
function togglePop(v){pop.classList.toggle('on',v);$('pick').setAttribute('aria-expanded',v);}
$('pick').addEventListener('click',()=>togglePop(!pop.classList.contains('on')));
$('prev').addEventListener('click',()=>setScenario(SC[(SC.indexOf(sim.sc)+SC.length-1)%SC.length]));
$('next').addEventListener('click',()=>setScenario(SC[(SC.indexOf(sim.sc)+1)%SC.length]));
let prefSrc='real',tab='st';
$('srcSeg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;prefSrc=b.dataset.v;setScenario(sim.sc);});
$('tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;tab=b.dataset.v;[...$('tabs').children].forEach(x=>x.setAttribute('aria-selected',x===b));renderPane();});
const REF=[['Na⁺','mEq/L',135,145,125,155],['K⁺','mEq/L',3.5,5.0,3.0,6.0],['Cl⁻','mEq/L',98,107,85,115],['이온화 Ca²⁺','mmol/L',1.15,1.30,1.0,1.5],['Mg²⁺','mg/dL',1.8,2.4,1.2,4],['Creatinine','mg/dL',.6,1.2,0,4]];
const REFG=[['pH','',7.35,7.45,7.2,7.55],['PaCO₂','mmHg',35,45,25,60],['PaO₂','mmHg',80,100,60,999],['HCO₃⁻','mEq/L',22,26,15,35],['Lactate','mmol/L',.5,2.0,0,4],['Base excess','mEq/L',-2,2,-10,10]];
const row=(r,v,dec)=>{const c=(v<r[2]?'lo':v>r[3]?'hi':'')+((v<r[4]||v>r[5])?' xx':'');
  return '<div class="'+c+'"><span class="n">'+r[0]+'</span><span class="v">'+v.toFixed(dec)+'</span><span class="r">'+r[2]+'–'+r[3]+' '+r[1]+'</span></div>';};
const li=a=>a.map(x=>'<li>'+x+'</li>').join('');
function renderPane(){
  const sc=sim.sc,R=sim.src==='real'?sim.real:null;let h='';
  if(tab==='st'){
    const bp=sc.vit.bp;
    h+='<section><h3>환자 상태 · Patient status</h3><dl><dt>의식 (Mental status)</dt><dd>'+sc.vit.loc+'</dd><dt>맥박 (Pulse)</dt><dd>'+sc.vit.pulse+'</dd><dt>혈압 (BP)</dt><dd>'+(bp?bp[0]+'/'+bp[1]+' mmHg (MAP '+Math.round((bp[0]+2*bp[1])/3)+')':'측정 불가')+'</dd><dt>SpO₂</dt><dd>'+(sc.vit.spo2==null?'측정 불가':sc.vit.spo2+' %')+'</dd><dt>호흡 (RR)</dt><dd>'+(sc.vit.rr?sc.vit.rr+' 회/분':'무호흡')+'</dd><dt>증상 (Sx)</dt><dd>'+sc.sx+'</dd></dl></section>';
    h+='<section><h3>파형 출처 · Data source</h3><div class="srcbox">'+(R?'<b>PTB-XL #'+R.id+'</b> · '+(R.age?R.age+'세 ':'')+(R.sex==='F'?'여':'남')+' · 12유도 100 Hz · '+R.dur.toFixed(1)+'초 구간 반복<br>원 판독: '+R.report.replace(/</g,'&lt;')+(sc.real&&sc.real.note?'<br>'+sc.real.note:'')
      :'<b>합성 파형</b> · 리듬 특징을 심장 쌍극자 모델로 생성'+(PT[sc.id]?'':'<br>이 리듬은 PTB-XL에 적합한 기록이 없어 합성만 제공합니다.'))+'</div></section>';
    h+='<p class="note">환자 상태와 검사 수치는 교육용 가상 증례입니다. PTB-XL 기록의 실제 환자 정보가 아닙니다.<br>3D 해부 모델: BodyParts3D © DBCLS (CC BY-SA 2.1 JP) · ECG: PTB-XL v1.0.3, PhysioNet (CC BY 4.0)</p>';
  }else if(tab==='lab'){
    h+='<section><h3>전해질 · Electrolytes</h3><div class="lab">'+REF.map((r,i)=>row(r,sc.lab[i],i===0||i===2?0:(i===3?2:1))).join('')+'</div></section>';
    h+='<section><h3>동맥혈 가스 분석 · ABGA</h3><div class="lab">'+REFG.map((r,i)=>row(r,sc.abg[i],i===0?2:(i===4?1:0))).join('')+'</div></section>';
    h+='<section><h3>심근 표지자 · Cardiac marker</h3><div class="lab">'+row(['hs-cTnI','ng/L',0,26,-1,260],sc.tn,0)+(sc.bnp?row(['NT-proBNP','pg/mL',0,300,-1,1800],sc.bnp,0):'')+'</div></section>';
    h+='<p class="note">가상 증례의 예시 수치입니다. 참고 범위는 검사실마다 다릅니다.</p>';
  }else if(tab==='ecg'){
    h+='<section><h3>심전도 소견 · ECG findings</h3><ul>'+li(sc.ecg)+'</ul></section><section><h3>병태생리 · Pathophysiology</h3><p>'+sc.heart+'</p></section>';
  }else if(tab==='cav'){
    h+=CAV;
  }else{
    h+='<section><h3>응급실 대응 · ED management</h3><ul>'+li(sc.er)+'</ul></section><p class="note">약물 용량은 성인 ACLS 기준 요약입니다. 기관 프로토콜을 우선하고, 실제 진료 판단에 쓰지 마세요.</p>';
  }
  $('pane').innerHTML=h;
}
function setScenario(sc){
  sim.sc=sc;sim.P=sim.P.filter(e=>e.t<=sim.t);sim.V=sim.V.filter(e=>e.t<=sim.t);
  const has=!!PT[sc.id];sim.src=has&&prefSrc==='real'?'real':'syn';sim.real=has?PT[sc.id]:null;
  [...$('srcSeg').children].forEach(b=>{b.disabled=b.dataset.v==='real'&&!has;b.setAttribute('aria-pressed',b.dataset.v===sim.src);});
  if(sim.src==='real'){sim.r0=sim.t;sim.s={t:sim.t};}else{sim.s={t:sim.t+.3};if(sc.init)sc.init(sim.s);}
  sim.loopHz=sim.src==='real'?sim.real.hr/60:1/.32;
  SC.forEach(x=>x.btn.setAttribute('aria-pressed',x===sc));
  const f=sc.flags||{};
  SU.uIsc.value.set(0,0,0,0);SU.uIscK.value=.95;if(f.infarct==='ant'){const p=LD.iscAnt;SU.uIsc.value.set(p[0],p[1],p[2],1.0);}else if(f.infarct==='inf'){const p=LD.iscInf;SU.uIsc.value.set(p[0],p[1],p[2],.85);}else if(f.isch){const p=LD.iscAnt;SU.uIsc.value.set(p[0],p[1],p[2],.85);SU.uIscK.value=.5;}
  corMats.lad.color.setHex(f.infarct==='ant'?0x4a3550:0xff7d5e);corMats.rca.color.setHex(f.infarct==='inf'?0x4a3550:0xff7d5e);
  const bp=sc.vit.bp;perfT=bp?clamp(((bp[0]+2*bp[1])/3-25)/60,.08,1):0;
  $('pickName').textContent=sc.name;$('pickDot').style.setProperty('--sev',sevVar[sc.sev]);
  $('stName').textContent=sc.name;$('stPill').textContent=sc.status;$('stPill').style.setProperty('--sev',sevVar[sc.sev]);
  $('vBP').textContent=bp?bp[0]+'/'+bp[1]:'--/--';$('vSP').textContent=sc.vit.spo2==null?'--':sc.vit.spo2;$('vRR').textContent=sc.vit.rr;
  $('srcLine').textContent=sim.src==='real'?'PTB-XL #'+sim.real.id+' · 실측 12유도':'합성 파형';
  applyLayers();renderPane();extrasScenario(sc);
  if(location.hash!=='#'+sc.id){try{history.replaceState(null,'','#'+sc.id);}catch(e){}}
}
let speed=1,paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
let vm='all';const ly={flow:true,cond:true,cor:true,ves:true,val:true};
$('tPause').setAttribute('aria-pressed',paused);
$('tPause').addEventListener('click',()=>{paused=!paused;$('tPause').setAttribute('aria-pressed',paused);});
$('spd').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;speed=+b.dataset.v;[...$('spd').children].forEach(x=>x.setAttribute('aria-pressed',x===b));});
$('tLayers').addEventListener('click',()=>{const v=!$('layers').classList.contains('on');$('layers').classList.toggle('on',v);$('tLayers').setAttribute('aria-expanded',v);});
[['lyFlow','flow'],['lyCond','cond'],['lyCor','cor'],['lyVes','ves'],['lyVal','val']].forEach(([id,k])=>$(id).addEventListener('change',e=>{ly[k]=e.target.checked;applyLayers();}));
$('lyGlow').addEventListener('change',e=>{glowOn=e.target.checked;});
function applyLayers(){
  const f=sim.sc.flags||{};heads.visible=tails.visible=(ly.flow&&vm!=='elec');
  condRoots.forEach(m=>{m.visible=(ly.cond&&vm!=='flow');});cond.forEach(o=>{o.dot.visible=false;});
  blkL.visible=(ly.cond&&vm!=='flow')&&!!f.lbb;blkR.visible=(ly.cond&&vm!=='flow')&&!!f.rbb;flLoop.visible=(ly.cond&&vm!=='flow')&&!!f.flutter;avLoop.visible=(ly.cond&&vm!=='flow')&&!!f.avnrt;focL.visible=focR.visible=false;
  cors.forEach(m=>{m.visible=ly.cor;});occLAD.visible=ly.cor&&f.infarct==='ant'&&!proc.reperf;occRCA.visible=ly.cor&&f.infarct==='inf'&&!proc.reperf;netL.visible=netR.visible=(ly.cond&&vm!=='flow');
  vessels.forEach(m=>{m.visible=ly.ves;});inner.forEach(m=>{m.visible=ly.val;});
  if(SU.uFlu.value>.5){inner.forEach(m=>{m.visible=false;});cors[3].visible=false;condRoots.forEach(m=>{m.visible=false;});netL.visible=netR.visible=false;heads.visible=tails.visible=false;}
}
function setOpacity(){const tr=+$('op').value;$('opO').textContent=tr+'%';const o=Math.max(.03,1-tr/100);opWall.value=o;opVes.value=Math.max(o,.5);transMats.forEach(([m])=>{m.depthWrite=o>.985;});}
$('op').addEventListener('input',setOpacity);
function setCut(){const v=+$('cut').value;$('cutO').textContent=v?v+'%':'끔';clip.constant=v?1.45-v/100*2.6:9;}
$('cut').addEventListener('input',setCut);

/* 부위 탭 → 이름 표시 */
const PART={
  lv:['좌심실 (LV)','전신으로 혈액을 내보내는 두꺼운 근육 방'],rv:['우심실 (RV)','폐동맥으로 정맥혈을 보내는 방'],la:['좌심방 (LA)','폐정맥에서 산소화된 혈액을 받음'],ra:['우심방 (RA)','상·하대정맥에서 정맥혈을 받음'],
  ao:['대동맥','상행 → 궁 → 하행. 궁에서 머리·팔로 가는 분지가 나옴'],pa:['폐동맥','우심실의 정맥혈을 양쪽 폐로 보냄'],pvn:['폐정맥','폐에서 산소화된 혈액을 좌심방으로'],svc:['상대정맥 (SVC)','상체의 정맥혈을 우심방으로'],ivc:['하대정맥 (IVC)','하체의 정맥혈을 우심방으로'],
  rca:['우관상동맥 (RCA)','우심실, 하벽, 대개 SA·AV node에 혈류 공급'],lad:['좌전하행지 (LAD)','좌심실 전벽, 심첨부, 중격 앞쪽 2/3'],lcx:['좌주간부·좌회선지 (LCx)','좌심실 측벽과 후벽'],cvn:['관상정맥동·대심장정맥','심근의 정맥혈을 우심방으로'],
  mv:['승모판과 건삭 (Mitral valve)','좌심방–좌심실 사이. 큰 전엽 + 가리비 모양 후엽(P1·P2·P3). 안장형 판륜, 건삭은 전외측·후내측 유두근으로. 이완기 열림 · 수축기 닫힘'],tv:['삼첨판과 건삭 (Tricuspid valve)','우심방–우심실 사이. 전엽·후엽·중격엽 3개, 건삭은 우심실 유두근과 중격으로. 이완기 열림 · 수축기 닫힘'],pv:['폐동맥판 (Pulmonic valve)','우심실 유출로의 반월판. 반월첨 3개가 왕관형 판륜에 붙음. 박출기 열림 · 이완기 닫힘'],av:['대동맥판 (Aortic valve)','좌심실 유출로의 반월판. 좌관상첨·우관상첨·무관상첨 3개, 가운데 결절(Arantius). 박출기 열림 · 이완기 닫혀 관상동맥 관류'],pap:['유두근','건삭을 당겨 방실판막의 역류를 막음'],
  sa:['동방결절 (SA node)','정상 박동의 시작점'],avn:['방실결절 (AV node)','심방 → 심실 전도를 지연시키는 관문'],inod:['결절간 경로','SA node에서 AV node로'],bach:['Bachmann 다발','우심방에서 좌심방으로 흥분 전달'],his:['His 다발','AV node에서 심실중격으로'],
  lbb:['좌각 (전·후 섬유속)','좌심실 심내막으로 전도'],rbb:['우각','중격 우측을 따라 우심실로'],purkL:['Purkinje 섬유 (좌심실)','심내막에서 심근으로 빠르게 전달'],purkR:['Purkinje 섬유 (우심실)','심내막에서 심근으로 빠르게 전달']};
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),call=$('call');let sel=null,down=null;
glc.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY,performance.now()];togglePop(false);});
glc.addEventListener('pointerup',e=>{if(!down)return;const d=Math.hypot(e.clientX-down[0],e.clientY-down[1]),dt=performance.now()-down[2];down=null;if(d<6&&dt<700&&tapIn3D(e))pickAt(e);});
function tapIn3D(e){if(!(typeof ECHO!=='undefined'&&ECHO.on))return true;const o=document.getElementById('eOri');if(!o||o.style.display==='none')return false;const r=o.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;}
function clearSel(){if(sel&&sel.mesh&&sel.mesh.material.emissive)sel.mesh.material.emissive.setHex(0);SU.uHi.value.set(0,0,0,0);sel=null;call.style.display='none';}
function pickAt(e){
  const r=glc.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(ndc,camera);
  const hits=ray.intersectObjects(pickables.filter(m=>{let o=m;while(o){if(!o.visible)return false;o=o.parent;}return true;}),false)
    .filter(h=>{const k=h.object.userData.pick;return !(h.object.material.clippingPlanes&&h.object.material.clippingPlanes.length&&clip.distanceToPoint(h.point)<0);});
  clearSel();if(!hits.length)return;
  let h=hits[0];const seeThrough=opWall.value<.45;
  if(seeThrough){const isShell=x=>['wall','ao','pa','pvn','svc','ivc'].includes(x.object.userData.pick);const inn=hits.find(x=>!isShell(x)&&x.distance<hits[0].distance+2.2);if(inn&&isShell(h))h=inn;}
  let k=h.object.userData.pick;
  if(k==='wall'){const w=wOf(h.point.x,h.point.y,h.point.z),i=w.indexOf(Math.max(w[0],w[1],w[2],w[3]));k=['lv','rv','la','ra'][i];SU.uHi.value.set(i===0?1:0,i===1?1:0,i===2?1:0,i===3?1:0);}
  else if(h.object.material.emissive)h.object.material.emissive.setHex(0x1f6f86);
  sel={mesh:k.length<=2&&'lvrvlara'.includes(k)?null:h.object,p:h.point.clone(),local:h.point.clone(),k};
  call.firstChild.textContent=PART[k][0];call.lastChild.textContent=PART[k][1];call.style.display='block';
}

/* 크기 */
function fitD(h,t){const asp=camera.aspect,v=h<420?3.6:(asp>1.25?3.4:4.4);return Math.max(v/t,3.9/(t*asp));}
function sizeAll(){
  const w=view.clientWidth,h=view.clientHeight;if(!w||!h)return;
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  if(composer){composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(w,h);}
  if(!userMoved){const t=Math.tan(camera.fov*Math.PI/360),d=fitD(h,t);camera.position.sub(TARGET).setLength(d).add(TARGET);}
  dpr=Math.min(devicePixelRatio||1,3);eW=ecgC.clientWidth;eH=ecgC.clientHeight;ecgC.width=Math.max(1,eW*dpr);ecgC.height=Math.max(1,eH*dpr);
}
new ResizeObserver(sizeAll).observe(view);new ResizeObserver(sizeAll).observe(ecgC);

/* ───────────── 7a. 상태 칩 · 해설 패널 · 주의사항 ───────────── */
const axG=new THREE.Group(),axL=[];axG.visible=false;heart.add(axG);let fpsE=.016,fpsN=0;
{const C0=new V3(.3,.05,.15),C1=new V3(.3,-.75,.15),lab=(t,col)=>{const cv=document.createElement('canvas');cv.width=160;cv.height=72;const x=cv.getContext('2d');x.font='600 44px "IBM Plex Mono",monospace';x.textAlign='center';x.textBaseline='middle';x.fillStyle='rgba(4,8,13,.78)';x.fillRect(0,0,160,72);x.strokeStyle=col;x.lineWidth=4;x.strokeRect(2,2,156,68);x.fillStyle=col;x.fillText(t,80,38);
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),transparent:true,depthTest:false}));sp.scale.set(.4,.18,1);sp.renderOrder=11;return sp;};
  LEADS.forEach((nm,i)=>{let d;if(i<6){const an=[0,60,120,-150,-30,90][i]*Math.PI/180;d=new V3(Math.cos(an),-Math.sin(an),0);}else d=new V3(LM[i][0],-.12,LM[i][2]).normalize();
    const len=i<6?1.95:1.7,O=i<6?C0:C1,hex=i<6?0x57d3e6:0xffb347,css=i<6?'#57d3e6':'#ffb347',e=O.clone().addScaledVector(d,len);
    const mat=new THREE.LineBasicMaterial({color:hex,transparent:true,depthTest:false});const ln=new THREE.Line(new THREE.BufferGeometry().setFromPoints([O,e]),mat);ln.renderOrder=10;
    const cone=new THREE.Mesh(new THREE.ConeGeometry(.055,.2,10),new THREE.MeshBasicMaterial({color:hex,depthTest:false}));cone.position.copy(e);cone.quaternion.setFromUnitVectors(new V3(0,1,0),d);cone.renderOrder=10;
    const sp=lab(nm,css);sp.position.copy(O).addScaledVector(d,len+.24);axG.add(ln,cone,sp);axL.push({i,mat,sp});});}
$('lyAx').addEventListener('change',e=>{axG.visible=e.target.checked;});
$('vmode').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;vm=b.dataset.v;[...$('vmode').children].forEach(x=>x.setAttribute('aria-pressed',x===b));applyLayers();});
document.querySelector('.brand').textContent='응급실 리듬별 3D 심장 시뮬레이터 · '+VER;
let lastLR=[null,null];
const PHN=$('phaseName'),PFL=$('pfill');let phPrev='';
function setPhase(f,ev,pe,L,R,t){
  let n;
  if(f.vfib)n='심실세동 · 박출 없음';
  else if(ev&&t-ev.t>=-.06&&t-ev.t<ev.end)n='QRS · 심실 흥분';
  else if(pe&&pe.kind==='sinus'&&t-pe.t<.12)n='P파 · 심방 수축';
  else if(L.ej>0||R.ej>0)n='수축기 · 박출';
  else if(L.c>.25)n='수축기 · 판막 닫힘';
  else if(ev&&t-ev.t<ev.qt+.06)n='T파 · 재분극';
  else n='이완기 · 심실 충만';
  if(n!==phPrev){PHN.textContent=n;phPrev=n;}
  const rr=ev&&ev.rr?ev.rr:.8,p=ev?clamp((t-ev.t)/rr,0,1):0;PFL.style.width=(p*100).toFixed(1)+'%';
}
/* ── 해설 일러스트 (설계 좌표 520×340) ── */
const bz=(p0,p1,p2,p3,n)=>{n=n||26;const o=[];for(let i=0;i<=n;i++){const t=i/n,u=1-t;o.push([u*u*u*p0[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t*t*t*p3[0],u*u*u*p0[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t*t*t*p3[1]]);}return o;};
const pln=(c,pts,col,w,dash)=>{c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.strokeStyle=col;c.lineWidth=w;c.setLineDash(dash||[]);c.stroke();c.setLineDash([]);};
const plen=pts=>{const L=[0];for(let i=1;i<pts.length;i++)L.push(L[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));return L;};
const pat=(pts,L,d)=>{d=clamp(d,0,L[L.length-1]);let i=1;while(i<L.length-1&&L[i]<d)i++;const q=(d-L[i-1])/Math.max(1e-6,L[i]-L[i-1]);return[pts[i-1][0]+(pts[i][0]-pts[i-1][0])*q,pts[i-1][1]+(pts[i][1]-pts[i-1][1])*q];};
const gdot=(c,x,y,r,col)=>{c.save();c.shadowColor=col;c.shadowBlur=r*3.2;c.fillStyle=col;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();c.restore();};
const fdots=(c,pts,u,n,r,col,a0,a1)=>{a0=a0||0;a1=a1==null?1:a1;const L=plen(pts),T=L[L.length-1];for(let j=0;j<n;j++){const f=(u+j/n)%1,p=pat(pts,L,(a0+(a1-a0)*f)*T);c.globalAlpha=Math.sqrt(Math.sin(Math.PI*f));gdot(c,p[0],p[1],r,col);}c.globalAlpha=1;};
const ppart=(c,pts,f0,f1,col,w)=>{if(f1<=f0)return;const L=plen(pts),T=L[L.length-1];c.save();c.shadowColor=col;c.shadowBlur=9;c.beginPath();for(let i=0;i<=22;i++){const p=pat(pts,L,(f0+(f1-f0)*i/22)*T);i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]);}c.strokeStyle=col;c.lineWidth=w;c.stroke();c.restore();};
const etx=(c,x,y,t,col,sz,al,wt)=>{c.font=(wt||'500')+' '+(sz||12)+'px "IBM Plex Sans KR",sans-serif';c.textAlign=al||'left';c.fillStyle=col||'#cfe3ee';c.fillText(t,x,y);c.textAlign='left';};
const rrect=(c,x,y,w,h,r)=>{c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();};
const echip=(c,x,y,t,col,al)=>{c.font='600 11px "IBM Plex Sans KR",sans-serif';const w=c.measureText(t).width+12;if(al==='c')x-=w/2;else if(al==='r')x-=w;c.fillStyle='rgba(6,13,22,.88)';rrect(c,x,y-9.5,w,19,5);c.fill();c.strokeStyle=col;c.lineWidth=1;c.stroke();c.fillStyle=col;c.textAlign='left';c.fillText(t,x+6,y+.5);};
const cross=(c,x,y,s,now)=>{const k=.5+.5*Math.sin(now*6);c.save();c.shadowColor='#ff3b4a';c.shadowBlur=10+8*k;c.strokeStyle='#ff4a58';c.lineWidth=3.2;c.beginPath();c.moveTo(x-s,y-s);c.lineTo(x+s,y+s);c.moveTo(x+s,y-s);c.lineTo(x-s,y+s);c.stroke();c.lineWidth=1.2;c.globalAlpha=.7*(1-k);c.beginPath();c.arc(x,y,s+6+8*k,0,TAU);c.stroke();c.restore();};
const HP={ao:bz([276,152],[276,72],[330,28],[446,36],30),pa:bz([246,152],[246,88],[200,46],[80,36],30),svc:[[190,6],[190,60],[190,96]],ivc:[[96,222],[126,170],[160,128]],pv1:[[470,92],[410,96],[352,104]],pv2:[[470,126],[410,122],[354,114]]};
const silPath=c=>{c.beginPath();c.moveTo(260,72);c.bezierCurveTo(214,36,138,52,138,122);c.bezierCurveTo(138,192,214,252,292,284);c.bezierCurveTo(352,252,398,192,392,122);c.bezierCurveTo(388,54,306,36,260,72);c.closePath();};
const rvPath=c=>{c.beginPath();c.moveTo(166,154);c.lineTo(246,154);c.bezierCurveTo(252,200,258,236,264,262);c.bezierCurveTo(216,246,168,206,166,154);c.closePath();};
const lvPath=c=>{c.beginPath();c.moveTo(284,154);c.lineTo(364,154);c.bezierCurveTo(366,206,330,250,294,270);c.bezierCurveTo(282,236,278,196,284,154);c.closePath();};
function leaflets(c,x0,x1,y,open,dir,col){const h=(x1-x0)/2,a=open*1.25*dir,av=dir>0;c.save();c.lineCap='round';
  [[x0,1],[x1,-1]].forEach(([xa,sg])=>{const L=h*(av?1.02:.98),ex=xa+sg*L*Math.cos(a),ey=y+L*Math.sin(a),mx=(xa+ex)/2,my=(y+ey)/2,bw=(av?-1:1)*(1-open)*6,nx=-(ey-y)/L*sg,ny=(ex-xa)/L*sg,cx=mx+nx*bw,cy=my+ny*bw;
    if(av){const px=xa+sg*h*.55,py=y+46;c.strokeStyle='rgba(245,228,212,.5)';c.lineWidth=.8;c.beginPath();c.moveTo(px,py);c.lineTo(ex,ey);c.moveTo(px,py);c.lineTo(mx,my);c.stroke();c.fillStyle='rgba(150,70,70,.85)';c.beginPath();c.ellipse(px,py+5,3.2,7,0,0,TAU);c.fill();}
    c.strokeStyle='rgba(0,0,0,.5)';c.lineWidth=5.4;c.beginPath();c.moveTo(xa,y);c.quadraticCurveTo(cx,cy,ex,ey);c.stroke();
    c.strokeStyle='#f1dccd';c.lineWidth=3.4;c.stroke();c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=1.1;c.stroke();
    c.fillStyle=col;c.beginPath();c.arc(xa,y,2.6,0,TAU);c.fill();});c.restore();}
// 4방 단면 기본도. o:{lv,rv,at,mv,tv,av,pv,dim,aoCol}
function heartBase(c,o){
  const tube=(pts,col,w)=>{pln(c,pts,'rgba(0,0,0,.55)',w+4);pln(c,pts,col,w);};
  const A=o.dim?.45:1;c.globalAlpha=A;
  tube(HP.svc,'#2c53b8',20);tube(HP.ivc,'#2c53b8',18);tube(HP.pv1,'#b8323e',11);tube(HP.pv2,'#b8323e',11);
  tube(HP.pa,o.paCol||'#3560cc',o.paW||22);tube(HP.ao,o.aoCol||'#c43a45',22);
  c.globalAlpha=1;
  const g=c.createRadialGradient(255,150,20,265,170,170);g.addColorStop(0,'#9a3540');g.addColorStop(1,'#4a161f');
  silPath(c);c.fillStyle=g;c.fill();c.strokeStyle='rgba(230,150,155,.55)';c.lineWidth=1.6;c.stroke();
  const cav=(draw,cx,cy,k,c0,c1)=>{c.save();c.translate(cx,cy);c.scale(1-k,1-k);c.translate(-cx,-cy);draw(c);const gg=c.createRadialGradient(cx,cy-10,4,cx,cy,70);gg.addColorStop(0,c1);gg.addColorStop(1,c0);c.fillStyle=gg;c.globalAlpha=o.dim?.4:1;c.fill();c.globalAlpha=1;c.strokeStyle='rgba(0,0,0,.45)';c.lineWidth=2;c.stroke();c.restore();};
  const ell=(x,y,rx,ry)=>cc=>{cc.beginPath();cc.ellipse(x,y,rx,ry,0,0,TAU);};
  cav(ell(190,112,38,28),190,112,.16*o.at,'#1f3f8f','#4b7df0');cav(ell(326,108,40,27),326,108,.16*o.at,'#8f1c28','#ee5a66');
  cav(rvPath,214,196,.24*o.rv,'#1f3f8f','#4b7df0');cav(lvPath,318,202,.3*o.lv,'#8f1c28','#ee5a66');
  if(!o.dim){
    const vc=v=>v>.5?'#7cf5a6':'#ffcf70';
    leaflets(c,168,244,153,o.tv,1,vc(o.tv));leaflets(c,286,362,153,o.mv,1,vc(o.mv));
    leaflets(c,236,256,146,o.pv,-1,vc(o.pv));leaflets(c,266,286,146,o.av,-1,vc(o.av));
  }
}
function ecgStrip(c,cursor){
  c.fillStyle='rgba(4,8,13,.75)';c.fillRect(0,292,520,48);c.strokeStyle='rgba(120,190,220,.18)';c.lineWidth=1;c.beginPath();c.moveTo(0,292.5);c.lineTo(520,292.5);c.stroke();
  const N=Math.floor(FS*2.6);c.beginPath();let pen=false;
  for(let i=0;i<=N;i++){const j=sim.n-1-N+i;if(j<0)continue;const v=buf[1][j%NB];if(v!==v){pen=false;continue;}const x=14+i/N*492,y=322-v*17;pen?c.lineTo(x,y):c.moveTo(x,y);pen=true;}
  c.strokeStyle='#6ff09a';c.lineWidth=1.6;c.stroke();gdot(c,506,322-(buf[1][(sim.n-1+NB)%NB]||0)*17,3,'#b6ffd0');
  etx(c,14,302,'II',"#6ff09a",10,'left','600');
}
const EXD={
flow(c,now){
  const L=lastLR[0]||{c:0,ej:0},R=lastLR[1]||{c:0,ej:0},t=sim.t,a=atrialC(t),mv=vOpen.mv.value,tv=vOpen.tv.value,av=aoValve.open,pv=vOpen.pv.value,u=(t*1.25)%1;
  heartBase(c,{lv:L.c,rv:R.c,at:a,mv,tv,av,pv});
  fdots(c,HP.svc,u,3,3,'#9cc0ff');fdots(c,HP.ivc,u,3,3,'#9cc0ff');fdots(c,HP.pv1,u,2,2.6,'#ff9a9a');fdots(c,HP.pv2,(u+.5)%1,2,2.6,'#ff9a9a');
  if(tv>.45)fdots(c,[[190,114],[202,152],[214,206]],u,4,3.2,'#9cc0ff');
  if(mv>.45)fdots(c,[[326,110],[324,152],[316,212]],u,4,3.2,'#ff9a9a');
  if(R.ej>0)fdots(c,[[224,206],[244,170]].concat(HP.pa),(t*1.7)%1,10,3.6,'#a9c8ff');
  if(L.ej>0)fdots(c,[[308,214],[280,172]].concat(HP.ao),(t*1.7)%1,10,3.6,'#ffb0a8');
  if(sim.sc.id==='pea')echip(c,260,60,'전기 활동은 있지만 심실이 수축하지 못함 → 맥박 없음','#ff9aa3','c');
  if((sim.sc.flags||{}).hcm){c.fillStyle='#7a2630';c.strokeStyle='#ffcf70';c.lineWidth=1.2;c.beginPath();c.ellipse(268,188,15,34,.08,0,TAU);c.fill();c.stroke();echip(c,404,236,'비대칭 중격 비후 → 유출로 폐쇄','#ffcf70','c');}
  etx(c,190,112,'RA','#fff',13,'center','600');etx(c,326,108,'LA','#fff',13,'center','600');etx(c,212,196,'RV','#fff',14,'center','600');etx(c,320,200,'LV','#fff',14,'center','600');
  etx(c,446,20,'대동맥 → 전신','#ffb0a8',11,'right');etx(c,14,76,'폐동맥 → 폐','#a9c8ff',11);etx(c,204,12,'상대정맥','#a9c8ff',10.5);etx(c,470,74,'폐정맥','#ffb0a8',10.5,'right');etx(c,92,236,'하대정맥','#a9c8ff',10.5,'center');
  echip(c,404,176,'방실판막 MV·TV '+(mv>.5?'열림':'닫힘'),mv>.5?'#7cf5a6':'#ffcf70');echip(c,404,200,'반월판 AV·PV '+(av>.5?'열림':'닫힘'),av>.5?'#7cf5a6':'#ffcf70');
  etx(c,14,22,phPrev,'#e6eef5',15,'left','600');etx(c,14,42,'3D 화면과 같은 박동입니다','#8fa3b5',10.5);
  ecgStrip(c);
},
cond(c,now){
  const f=(sim.sc&&sim.sc.flags)||{},id=sim.sc?sim.sc.id:'',sp=.4*(id==='stach'?1.5:id==='sbrady'?.6:1),cyc=(now*sp)%1,n=Math.floor(now*sp);
  heartBase(c,{lv:0,rv:0,at:0,dim:1});
  const SAp=[172,92],AVp=[258,146],inod=[bz(SAp,[190,66],[240,104],AVp),bz(SAp,[204,112],[232,126],AVp),bz(SAp,[166,138],[222,152],AVp)],bach=bz(SAp,[220,58],[290,66],[326,100]);
  const his=[[258,146],[262,178]],lb=[[262,178],[274,216],[288,250],[296,266],[330,238],[352,202],[362,164]],rb=[[262,178],[254,216],[258,246],[262,258],[222,238],[188,206],[170,164]];
  const dimc='rgba(255,225,77,.22)';inod.forEach(p=>pln(c,p,dimc,2));pln(c,bach,dimc,2);pln(c,his,dimc,4);pln(c,lb,dimc,3);pln(c,rb,dimc,3);
  [[lb,318,202],[rb,214,196]].forEach(([p,cx,cy])=>{for(let i=3;i<p.length;i++)for(const q of[0,.5]){const a=p[i-1],b=p[i],x=a[0]+(b[0]-a[0])*q,y=a[1]+(b[1]-a[1])*q,d=Math.hypot(x-cx,y-cy);pln(c,[[x,y],[x+(x-cx)/d*11,y+(y-cy)/d*11]],dimc,1.4);}});
  const avb=id==='chb'?'chb':id==='m2'?'m2':id==='wb'?'wb':null;
  let drop=avb==='chb'||(avb==='m2'&&n%3===2)||(avb==='wb'&&n%4===3)||(f.afib&&(n*7)%3===0),dl=avb==='wb'?.05*(n%4):(id==='avb1'?.12:0);
  let pA=clamp(cyc/.18,0,1),pH=drop?0:clamp((cyc-.38-dl)/.07,0,1),pB=drop?0:clamp((cyc-.45-dl)/.26,0,1),atr=true;
  if(avb==='chb'){const ce=(now*.19)%1;pH=clamp(ce/.1,0,1)*(ce<.6?1:0);pB=clamp((ce-.1)/.34,0,1)*(ce<.6?1:0);}
  if(f.vfib){atr=false;pA=pH=pB=0;}
  const foc=id==='vt'||id==='tdp'||(id==='pvc'&&n%2===1)?(id==='pvc'?'r':'l'):null,junc=id==='junc',reent=!!f.avnrt||junc;
  if(f.flutter||reent||foc||id==='asys')atr=false;if(foc||id==='asys'){pH=pB=0;}
  const Y=EY;
  if(f.afib||f.vfib){const k=Math.floor(now*14);for(let i=0;i<16;i++){const r1=Math.abs(Math.sin((k+i)*12.9898)*43758.5453)%1,r2=Math.abs(Math.sin((k+i)*78.233)*12543.123)%1;
      const p=f.vfib?(i%2?[180+r1*70,160+r2*80]:[285+r1*70,160+r2*90]):(i%2?[160+r1*60,92+r2*40]:[294+r1*64,90+r2*36]);gdot(c,p[0],p[1],2.4,Y);}
    echip(c,f.vfib?264:258,f.vfib?300:60,f.vfib?'심실 전체가 무질서하게 흥분 → 수축 불가':'심방 내 무질서한 소파동 · AV node가 일부만 통과','#ffcf70','c');}
  if(atr&&!f.afib){
    if(cyc<.3){c.save();c.globalAlpha=.3*Math.sin(Math.PI*cyc/.3);c.fillStyle=Y;c.beginPath();c.ellipse(190,112,38,28,0,0,TAU);c.ellipse(326,108,40,27,0,0,TAU);c.fill();c.restore();}
    inod.forEach(p=>ppart(c,p,Math.max(0,pA-.35),pA,Y,3));ppart(c,bach,Math.max(0,pA-.35),pA,Y,3);
    gdot(c,SAp[0],SAp[1],cyc<.08?9:6,Y);
  }else gdot(c,SAp[0],SAp[1],5,'rgba(255,225,77,.4)');
  const hold=!f.vfib&&cyc>.18&&cyc<.38+dl;gdot(c,AVp[0],AVp[1],hold?7+2*Math.sin(now*14):6,drop&&cyc>.18&&cyc<.6?'#ff4a58':hold?'#ffb347':Y);
  if(drop&&avb&&cyc>.18)cross(c,AVp[0]+2,AVp[1]+16,7,now);
  if(f.flutter){c.strokeStyle='rgba(255,179,71,.6)';c.lineWidth=2;c.beginPath();c.ellipse(190,118,28,20,0,0,TAU);c.stroke();const a2=now*9;gdot(c,190+28*Math.cos(a2),118+20*Math.sin(a2),4.5,Y);echip(c,258,24,'우심방 재진입 회로 (약 300/분) · AV node가 2번 중 1번 전달','#ffcf70','c');}
  if(f.avnrt){const a2=now*14;c.strokeStyle='rgba(255,179,71,.8)';c.lineWidth=1.6;c.beginPath();c.ellipse(258,146,11,7.5,0,0,TAU);c.stroke();gdot(c,258+11*Math.cos(a2),146+7.5*Math.sin(a2),3,Y);echip(c,258,24,'AV node 재진입 → 심방·심실이 거의 동시에 흥분','#ffcf70','c');}
  if(reent&&pH>0&&cyc<.8)inod.forEach(p=>ppart(c,p,1-clamp((cyc-.38-dl)/.22,0,1),1,Y,2.5));
  if(junc)echip(c,258,24,'접합부에서 시작 → 심실은 정상 경로, 심방은 역행','#ffcf70','c');
  if(foc){const q=clamp((cyc-.3)/.5,0,1);if(q>0&&q<1)focusRings(c,foc==='l'?350:186,215,q,foc==='r');echip(c,foc==='l'?404:118,250,'이소성 초점 → 근육 경유 전파','#ff9a3d','c');}
  if(id==='asys')echip(c,258,24,'전기 활동 없음','#ff9aa3','c');if(id==='hk')echip(c,258,24,'전도 전체가 느려짐 → P 소실, 넓은 QRS, 뾰족한 T','#ffcf70','c');
  ppart(c,his,0,pH,Y,5);
  const lOK=!f.lbb,rOK=!f.rbb;
  if(lOK)ppart(c,lb,Math.max(0,pB-.4),pB,Y,4);else cross(c,270,200,7,now);
  if(rOK)ppart(c,rb,Math.max(0,pB-.4),pB,Y,4);else cross(c,256,200,7,now);
  if(pB>.5&&(lOK||rOK)){c.save();c.globalAlpha=.3*Math.sin(Math.PI*(pB-.5)/.5);c.fillStyle=Y;if(rOK){rvPath(c);c.fill();}if(lOK){lvPath(c);c.fill();}c.restore();}
  if((f.lbb||f.rbb)&&pB>.45){const q=clamp((cyc-.6)/.32,0,1),cx=f.lbb?272:254,s0=f.lbb?-1.25:Math.PI-1.1,s1=f.lbb?1.15:Math.PI+1.3;c.save();f.lbb?lvPath(c):rvPath(c);c.clip();
    for(let k=0;k<3;k++){const r=14+105*clamp(q-k*.12,0,1);c.globalAlpha=.8*(1-q);c.strokeStyle='#ff9a3d';c.lineWidth=6;c.beginPath();c.arc(cx,206,r,s0,s1);c.stroke();}c.restore();
    echip(c,f.lbb?404:118,236,'근육을 타고 느리게 전파 → 넓은 QRS','#ff9a3d',f.lbb?'c':'c');}
  echip(c,132,72,'SA node',Y,'r');echip(c,300,140,hold?'AV node · 지연 (PR 간격)':'AV node',hold?'#ffb347':Y);echip(c,400,176,'좌각 LBB',f.lbb?'#ff4a58':Y);echip(c,120,176,'우각 RBB',f.rbb?'#ff4a58':Y,'r');etx(c,300,280,'Purkinje 섬유','#d9c45a',10.5);
  if(avb)echip(c,258,24,avb==='chb'?'완전 방실차단: 심방 신호 전부 차단 · 심실은 이탈 박동':avb==='m2'?(drop?'전도 실패 → QRS 탈락':'Mobitz II: 예고 없이 탈락'):(drop?'전도 실패 → QRS 탈락':'Mobitz I: PR이 점점 길어짐 ('+(n%4+1)+'/4)'),'#ff9aa3','c');
  etx(c,14,22,'느린 재생','#8fa3b5',10.5);
  // 이상화한 ECG와 진행 커서
  c.fillStyle='rgba(4,8,13,.75)';c.fillRect(0,292,520,48);const wide=f.lbb||f.rbb||avb==='chb'||!!foc||id==='hk',x0=.47+dl;c.beginPath();
  for(let i=0;i<=240;i++){const x=i/240;let y=0;if(atr&&!f.afib)y+=.13*gs(x,.09,.03);if(f.afib)y+=.03*Math.sin(x*90+n);if(f.vfib)y+=.5*Math.sin(x*38+n)*Math.sin(x*11+n*2);
    if(!drop&&!f.vfib&&avb!=='chb'&&id!=='asys'){const w=wide?2.6:1;y+=-.1*gs(x,x0-.014*w,.008*w)+1*gs(x,x0,.012*w)+(wide?.55*gs(x,x0+.03,.02):0)-.22*gs(x,x0+.018*w+(wide?.03:0),.01*w)+(wide?-.25:.26)*gs(x,x0+.22,.05);}
    const X=14+x*492,Y2=326-y*26;i?c.lineTo(X,Y2):c.moveTo(X,Y2);}
  c.strokeStyle='#6ff09a';c.lineWidth=1.6;c.stroke();c.strokeStyle='rgba(255,225,77,.8)';c.lineWidth=1.4;c.beginPath();c.moveTo(14+cyc*492,296);c.lineTo(14+cyc*492,338);c.stroke();
  if(avb==='chb')etx(c,506,304,'P파와 QRS가 서로 무관','#ff9aa3',10.5,'right');
},
mi(c,now){
  const f=(sim.sc&&sim.sc.flags)||{},side=f.infarct==='inf'?'rca':'lad',occ=f.infarct?!proc.reperf:(exDemo%2===1),u=(now*.5)%1;
  const tube=(pts,col,w)=>{pln(c,pts,'rgba(0,0,0,.5)',w+4);pln(c,pts,col,w);};
  tube([[262,8],[262,70]],'#c43a45',30);
  const g=c.createRadialGradient(250,140,20,265,170,175);g.addColorStop(0,'#a03a44');g.addColorStop(1,'#54202a');silPath(c);c.fillStyle=g;c.fill();c.strokeStyle='rgba(230,150,155,.55)';c.lineWidth=1.6;c.stroke();
  const lm=[[274,74],[292,92]],lad=[[292,92],[301,130],[296,180],[289,230],[291,272]],d1=[[299,138],[330,162],[346,192]],lcx=[[292,92],[330,96],[366,118],[385,152]],om=[[366,118],[373,160],[363,196]];
  const rca=[[250,74],[205,92],[167,130],[158,172],[177,216],[233,257]],rvb=[[167,130],[197,160],[206,192]],pda=[[233,257],[264,263]];
  const oF=side==='lad'?.2:.28,ves=side==='lad'?lad:rca,oL=plen(ves),oP=pat(ves,oL,oF*oL[oL.length-1]),tc=side==='lad'?[306,214]:[186,214];
  const grow=.45+.55*(.5+.5*Math.sin(now*.7));
  if(occ||proc.reperf){c.save();silPath(c);c.clip();const r=62+52*(proc.reperf?.6:grow),tg=c.createRadialGradient(tc[0],tc[1],6,tc[0],tc[1],r);
    if(proc.reperf){tg.addColorStop(0,'rgba(255,170,170,.45)');tg.addColorStop(1,'rgba(255,170,170,0)');}else{tg.addColorStop(0,'rgba(22,14,52,.95)');tg.addColorStop(.6,'rgba(70,24,70,.8)');tg.addColorStop(.86,'rgba(255,60,80,'+(.35+.3*Math.sin(now*5))+')');tg.addColorStop(1,'rgba(255,60,80,0)');}
    c.fillStyle=tg;c.fillRect(0,0,520,300);c.restore();}
  const art=(pts,w,dead)=>{pln(c,pts,'rgba(0,0,0,.55)',w+3);pln(c,pts,dead?'#5b4a5c':'#ff8a66',w,dead?[5,5]:null);if(!dead)fdots(c,pts,u,Math.max(2,pts.length),w*.42,'#ffe0d4');};
  const dl=occ&&side==='lad',dr=occ&&side==='rca';
  art(lm,6);art(lcx,5);art(om,3);art(d1,3,dl);art(rvb,3,dr);art(pda,3,dr);
  [[lad,dl],[rca,dr]].forEach(([p,dead])=>{if(!dead){art(p,5.5);return;}pln(c,p,'rgba(0,0,0,.55)',8.5);pln(c,p,'#5b4a5c',5.5,[5,5]);ppart(c,p,0,oF,'#ff8a66',5.5);fdots(c,p,u,3,2.4,'#ffe0d4',0,oF);});
  echip(c,312,84,'LMCA','#ffb59c');echip(c,322,250,'LAD','#ffb59c');echip(c,404,150,'LCx','#ffb59c');echip(c,146,206,'RCA','#ffb59c','r');
  if(occ){cross(c,oP[0],oP[1],8,now);
    const ix=452,iy=98,ir=48;pln(c,[oP,[ix-ir*.8,iy+ir*.5]],'rgba(255,255,255,.35)',1,[3,3]);c.save();c.beginPath();c.arc(ix,iy,ir,0,TAU);c.clip();c.fillStyle='#3a1218';c.fillRect(ix-ir,iy-ir,ir*2,ir*2);
    c.fillStyle='#c8323e';c.fillRect(ix-ir,iy-17,ir*2,34);c.fillStyle='#e6c468';c.beginPath();c.ellipse(ix+2,iy+19,34,17,0,Math.PI,TAU);c.fill();c.fillStyle='#b98f38';c.beginPath();c.ellipse(ix+2,iy+17,20,8,0,Math.PI,TAU);c.fill();
    const j=1.5*Math.sin(now*5);c.fillStyle='#5a0f1a';c.beginPath();c.ellipse(ix+4,iy-3+j*.3,24+j,15,0,0,TAU);c.fill();fdots(c,[[ix-ir,iy-6],[ix-22,iy-6]],u,3,2.2,'#ffd0c8');
    c.restore();c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=1.4;c.beginPath();c.arc(ix,iy,ir,0,TAU);c.stroke();etx(c,ix,iy+ir+13,'플라크 파열 + 혈전','#ffcf70',11,'center','600');etx(c,ix,iy+ir+28,'(혈관 단면 확대)','#8fa3b5',10,'center');
    echip(c,tc[0],tc[1]+34,'허혈 심근 · 수축 저하','#ff9aa3','c');}
  etx(c,14,22,occ?(side==='lad'?'LAD 폐색 → 전벽·심첨부 허혈':'RCA 폐색 → 하벽·우심실 허혈'):proc.reperf?'재관류: 혈류 회복':'정상 관류','#e6eef5',14,'left','600');
  if(!f.infarct)etx(c,14,42,'그림을 탭하면 폐색 예시를 보여 줍니다','#8fa3b5',10.5);
  c.fillStyle='rgba(4,8,13,.75)';c.fillRect(0,292,520,48);const bg=c.createLinearGradient(20,0,500,0);bg.addColorStop(0,'#ff8a66');bg.addColorStop(.35,'#b0304a');bg.addColorStop(1,'#241440');c.fillStyle=bg;rrect(c,20,304,480,7,3.5);c.fill();
  etx(c,20,326,'0분 · 허혈 시작','#cfe3ee',10.5);etx(c,190,326,'20–40분 · 괴사 시작','#cfe3ee',10.5,'center');etx(c,500,326,'수 시간 · 전층 괴사','#cfe3ee',10.5,'right');
  if(occ)gdot(c,20+480*clamp((grow-.45)/.55,0,1),307.5,5,'#fff');
},
shunt(c,now){
  const f=(sim.sc&&sim.sc.flags)||{},ty=f.shunt||['vsd','asd','pda','tof'][exDemo%4],L=lastLR[0]||{c:0,ej:0},R=lastLR[1]||{c:0,ej:0},t=sim.t,a=atrialC(t),u=(t*1.25)%1,sys=L.c>.12,tof=ty==='tof';
  heartBase(c,{lv:L.c,rv:R.c,at:a,mv:vOpen.mv.value,tv:vOpen.tv.value,av:aoValve.open,pv:vOpen.pv.value,aoCol:tof?'#8a3f9a':null,paW:tof?12:null});
  fdots(c,HP.svc,u,3,3,'#9cc0ff');fdots(c,HP.pv1,u,2,2.6,'#ff9a9a');
  if(vOpen.tv.value>.45)fdots(c,[[190,114],[202,152],[214,206]],u,4,3,'#9cc0ff');if(vOpen.mv.value>.45)fdots(c,[[326,110],[324,152],[316,212]],u,4,3,'#ff9a9a');
  if(R.ej>0)fdots(c,[[224,206],[244,170]].concat(HP.pa),(t*1.7)%1,tof?4:(ty==='vsd'?13:9),3.4,ty==='vsd'||ty==='asd'?'#d9a6ff':'#a9c8ff');
  if(L.ej>0)fdots(c,[[308,214],[280,172]].concat(HP.ao),(t*1.7)%1,9,3.4,tof?'#c79aff':'#ffb0a8');
  const hole=(x,y,w,h)=>{c.fillStyle='#05080c';rrect(c,x-w/2,y-h/2,w,h,4);c.fill();c.strokeStyle='#ffcf70';c.lineWidth=1.4;c.stroke();};
  let msg='';
  if(ty==='vsd'||tof){hole(266,206,22,20);
    if(sys)fdots(c,tof?[[226,206],[266,206],[278,172]].concat(HP.ao.slice(0,12)):[[306,206],[266,206],[226,208],[214,222]],(t*2.2)%1,6,3.6,tof?'#7fa8ff':'#ff7a70');
    echip(c,266,232,'VSD','#ffcf70','c');msg=tof?'우심실 유출로가 좁아 정맥혈이 VSD를 지나 대동맥으로 (우→좌) → 청색증':'수축기에 좌심실 → 우심실 (좌→우) · 폐혈류 증가, 좌심 용적 과부하';}
  if(tof){c.fillStyle='#05080c';c.beginPath();c.moveTo(232,128);c.lineTo(242,120);c.lineTo(232,112);c.closePath();c.moveTo(260,128);c.lineTo(250,120);c.lineTo(260,112);c.closePath();c.fill();echip(c,150,62,'폐동맥 협착 (PS)','#ff9aa3','c');echip(c,400,60,'대동맥 기승 · 혼합혈','#c79aff','c');echip(c,150,250,'우심실 비대','#ff9aa3','c');}
  if(ty==='asd'){const p=[[292,110],[258,104],[226,110]];pln(c,p,'#05080c',15);pln(c,p,'rgba(255,207,112,.7)',1.2,[3,3]);fdots(c,p,(t*1.3)%1,4,3.4,'#ff7a70');echip(c,258,84,'ASD','#ffcf70','c');msg='좌심방 → 우심방 (좌→우) · 우심 용적 과부하, 고정 분열 S2';}
  if(ty==='pda'){const p=[HP.ao[13],HP.pa[11]];pln(c,p,'rgba(0,0,0,.55)',14);pln(c,p,'#b8508a',10);fdots(c,p,(t*1.6)%1,3,3.2,'#ff7a70');echip(c,(p[0][0]+p[1][0])/2,(p[0][1]+p[1][1])/2-18,'PDA','#ffcf70','c');msg='대동맥 → 폐동맥 (수축기·이완기 내내) · 넓은 맥압, 연속성 잡음';}
  etx(c,190,112,'RA','#fff',13,'center','600');etx(c,326,108,'LA','#fff',13,'center','600');etx(c,212,190,'RV','#fff',14,'center','600');etx(c,322,196,'LV','#fff',14,'center','600');
  etx(c,14,22,{vsd:'심실중격결손 (VSD)',asd:'심방중격결손 (ASD)',pda:'동맥관 개존 (PDA)',tof:'Fallot 4징 (TOF)'}[ty],'#e6eef5',15,'left','600');
  if(!f.shunt)etx(c,14,42,'그림을 탭하면 다른 단락을 보여 줍니다','#8fa3b5',10.5);
  c.fillStyle='rgba(4,8,13,.75)';c.fillRect(0,292,520,48);etx(c,260,316,msg,'#e6eef5',12,'center');
},
pci(c,now){
  const T=now%12,cy=140,H0=36,amp=T<5.2?25:25-20*ss(5.2,7.2,T),lum=x=>H0-amp*gs(x,270,46);
  const wg=c.createLinearGradient(0,cy-52,0,cy+52);wg.addColorStop(0,'#8a3a44');wg.addColorStop(.5,'#5a1f28');wg.addColorStop(1,'#8a3a44');c.fillStyle=wg;rrect(c,14,cy-H0-13,492,(H0+13)*2,10);c.fill();
  c.beginPath();for(let x=14;x<=506;x+=4)x===14?c.moveTo(x,cy-lum(x)):c.lineTo(x,cy-lum(x));for(let x=506;x>=14;x-=4)c.lineTo(x,cy+lum(x));c.closePath();
  const lg=c.createLinearGradient(0,cy-H0,0,cy+H0);lg.addColorStop(0,'#a82632');lg.addColorStop(.5,'#e04a55');lg.addColorStop(1,'#a82632');c.fillStyle=lg;c.fill();
  for(const s of[-1,1]){c.beginPath();c.moveTo(170,cy+s*H0);for(let x=170;x<=370;x+=4)c.lineTo(x,cy+s*lum(x));c.lineTo(370,cy+s*H0);c.closePath();c.fillStyle='#e9c96c';c.fill();c.strokeStyle='#fff3c4';c.lineWidth=1;c.stroke();
    c.fillStyle='#c79a3c';c.beginPath();c.ellipse(270,cy+s*(H0-amp*.42),30,Math.max(1.5,amp*.3),0,0,TAU);c.fill();}
  const sp=T<5.2?.22:T<9.5?.12:.7,u=(now*sp)%1;
  for(let j=0;j<30;j++){const x=14+((u+j/30)%1)*492,yy=(Math.abs(Math.sin(j*12.9898)*43758.5453)%1*2-1)*.72;if(T<5.2&&x>300&&j%3)continue;if(T>=5.2&&T<9.5&&x>215)continue;c.globalAlpha=.9;gdot(c,x,cy+yy*lum(x),2.6,'#ffd9d2');}c.globalAlpha=1;
  const wt=T<2?0:T<9?14+478*ss(2,3.8,T):14+478*(1-ss(9,10,T));if(wt>14)pln(c,[[14,cy],[wt,cy]],'#e8eef4',1.6);
  const bx=T<4?-80:T<5.2?-60+330*ss(4,5.1,T):T<8.6?270:270-380*ss(8.6,9.6,T),bh=T<5.2?5:T<7.4?5+26*ss(5.2,7,T):T<8.4?31-26*ss(7.5,8.3,T):5;
  const sh=T<5.2?0:Math.min(31,T<7.4?bh:31);
  if(sh>6){c.strokeStyle='#e4edf5';c.lineWidth=1.4;c.beginPath();for(let x=216;x<324;x+=12){c.moveTo(x,cy-sh);c.lineTo(x+6,cy+sh);c.lineTo(x+12,cy-sh);c.moveTo(x,cy+sh);c.lineTo(x+6,cy-sh);c.lineTo(x+12,cy+sh);}c.moveTo(216,cy-sh);c.lineTo(324,cy-sh);c.moveTo(216,cy+sh);c.lineTo(324,cy+sh);c.stroke();}
  if(bx>-70){pln(c,[[14,cy],[bx-58,cy]],'#7fb6d6',3.4);c.fillStyle='rgba(159,232,255,.28)';rrect(c,bx-58,cy-bh,116,bh*2,Math.min(bh,14));c.fill();c.strokeStyle='rgba(190,240,255,.95)';c.lineWidth=1.6;c.stroke();}
  etx(c,22,cy-H0-24,'혈류 →','#ffb0a8',11.5,'left','600');etx(c,270,cy+H0+26,'플라크 (지질핵 + 섬유막)','#ffcf70',11,'center');etx(c,498,cy-H0-24,'혈관 종단면','#8fa3b5',10.5,'right');
  const st=T<2?0:T<4?1:T<5.2?2:T<8.6?3:4,names=['협착','와이어 통과','풍선 위치','확장 + 스텐트','결과'],desc=['플라크가 내강을 좁혀 혈류가 줄어든 상태','가이드와이어가 병변을 지나 길을 만듭니다','풍선 카테터를 와이어 위로 병변까지 진행','풍선이 플라크를 벽으로 밀어내고 스텐트가 펴집니다','스텐트가 내강을 유지 · 혈류 회복 (TIMI 3)'];
  c.fillStyle='rgba(4,8,13,.75)';c.fillRect(0,236,520,104);
  names.forEach((nm,i)=>{const x=20+i*98,on=i===st;c.fillStyle=on?'rgba(87,211,230,.18)':'rgba(255,255,255,.04)';rrect(c,x,250,90,26,7);c.fill();c.strokeStyle=on?'#57d3e6':'rgba(120,190,220,.25)';c.lineWidth=on?1.6:1;c.stroke();etx(c,x+45,263.5,(i+1)+' '+nm,on?'#57d3e6':'#8fa3b5',11,'center',on?'600':'500');});
  etx(c,260,304,desc[st],'#e6eef5',12.5,'center');
}};
const EXD_flow=(c,now)=>EXD.flow(c,now),EXD_cond=(c,now)=>EXD.cond(c,now),EXD_shunt=(c,now)=>EXD.shunt(c,now);
/* ── 리듬별 해설 디렉터: 기전 + 치료 시네마틱 ── */
const CP={sa:[172,92],av:[258,146],his:[[258,146],[262,178]],lb:[[262,178],[274,216],[288,250],[296,266],[330,238],[352,202],[362,164]],rb:[[262,178],[254,216],[258,246],[262,258],[222,238],[188,206],[170,164]]};
CP.inod=[bz(CP.sa,[190,66],[240,104],CP.av),bz(CP.sa,[204,112],[232,126],CP.av),bz(CP.sa,[166,138],[222,152],CP.av)];CP.bach=bz(CP.sa,[220,58],[290,66],[326,100]);
const EY='#e6ff5a';
function condDim(c){const d='rgba(230,255,90,.2)';CP.inod.forEach(p=>pln(c,p,d,2));pln(c,CP.bach,d,2);pln(c,CP.his,d,4);pln(c,CP.lb,d,3);pln(c,CP.rb,d,3);
  [[CP.lb,318,202],[CP.rb,214,196]].forEach(([p,cx,cy])=>{for(let i=3;i<p.length;i++)for(const q of[0,.5]){const a=p[i-1],b=p[i],x=a[0]+(b[0]-a[0])*q,y=a[1]+(b[1]-a[1])*q,dd=Math.hypot(x-cx,y-cy);pln(c,[[x,y],[x+(x-cx)/dd*11,y+(y-cy)/dd*11]],d,1.4);}});}
function sinusBeat(c,cyc,noA){const pA=clamp(cyc/.18,0,1),pH=clamp((cyc-.36)/.07,0,1),pB=clamp((cyc-.43)/.26,0,1);
  if(!noA){if(cyc<.3){c.save();c.globalAlpha=.3*Math.sin(Math.PI*cyc/.3);c.fillStyle=EY;c.beginPath();c.ellipse(190,112,38,28,0,0,TAU);c.ellipse(326,108,40,27,0,0,TAU);c.fill();c.restore();}
    CP.inod.forEach(p=>ppart(c,p,Math.max(0,pA-.35),pA,EY,3));ppart(c,CP.bach,Math.max(0,pA-.35),pA,EY,3);gdot(c,CP.sa[0],CP.sa[1],cyc<.08?9:6,EY);}
  gdot(c,CP.av[0],CP.av[1],cyc>.18&&cyc<.36?8:6,cyc>.18&&cyc<.36?'#ffb347':EY);ppart(c,CP.his,0,pH,EY,5);ppart(c,CP.lb,Math.max(0,pB-.4),pB,EY,4);ppart(c,CP.rb,Math.max(0,pB-.4),pB,EY,4);
  if(pB>.5){c.save();c.globalAlpha=.3*Math.sin(Math.PI*(pB-.5)/.5);c.fillStyle=EY;rvPath(c);c.fill();lvPath(c);c.fill();c.restore();}}
const hsh=(a,b)=>Math.abs(Math.sin(a*12.9898+b*78.233)*43758.5453)%1;
function sparks(c,now,where,n){const k=Math.floor(now*14);for(let i=0;i<(n||16);i++){const r1=hsh(k+i,1),r2=hsh(k+i,2),p=where==='v'?(i%2?[180+r1*70,160+r2*80]:[285+r1*70,160+r2*90]):(i%2?[160+r1*60,92+r2*40]:[294+r1*64,90+r2*36]);gdot(c,p[0],p[1],2.4,EY);}}
function focusRings(c,x,y,q,right){c.save();right?rvPath(c):lvPath(c);c.clip();for(let k=0;k<3;k++){const r=8+120*clamp(q-k*.12,0,1);c.globalAlpha=.85*(1-q);c.strokeStyle='#ff9a3d';c.lineWidth=6;c.beginPath();c.arc(x,y,r,0,TAU);c.stroke();}c.restore();gdot(c,x,y,5+3*Math.sin(q*20),'#ff9a3d');}
// 치료 장면용 ECG 띠 (최근 4초)
const W_={sin:(t,T)=>{const p=((t%T)+T)%T;return .12*gs(p,.1,.03)+gs(p,.26,.012)-.2*gs(p,.29,.012)+.25*gs(p,.5,.05);},
  vf:t=>.5*Math.sin(31*t)*Math.sin(7*t)+.28*Math.sin(53*t+1),af:t=>gs(((t+.07*Math.sin(3.7*t))%.47+.47)%.47,.1,.012)+.035*Math.sin(60*t),
  afl:t=>.14-.28*((t*5)%1)+gs(t%.4,.1,.012),svt:t=>gs(t%.33,.08,.012)+.2*gs(t%.33,.2,.04),vt:t=>.85*Math.sin(TAU*t/.34),
  brady:t=>.1*gs(t%.75,.1,.03)+.9*gs(t%1.7,.3,.035)-.3*gs(t%1.7,.52,.07),pace:t=>{const p=t%.85;return 1.25*gs(p,.05,.004)+.85*gs(p,.13,.04)-.38*gs(p,.32,.07);}};
function tStrip(c,T,fn,marks){c.fillStyle='rgba(4,8,13,.72)';rrect(c,10,252,500,38,6);c.fill();c.strokeStyle='rgba(120,190,220,.2)';c.lineWidth=1;c.stroke();
  c.beginPath();for(let i=0;i<=300;i++){const t=T-4+i/300*4,y=274-fn(t)*15,x=16+i/300*488;i?c.lineTo(x,y):c.moveTo(x,y);}c.strokeStyle='#6ff09a';c.lineWidth=1.6;c.stroke();
  if(marks)marks.forEach(t=>{const x=16+(t-(T-4))/4*488;if(x>16&&x<504){c.fillStyle='#57d3e6';c.beginPath();c.moveTo(x-4,255);c.lineTo(x+4,255);c.lineTo(x,261);c.closePath();c.fill();}});}
const SC2={
flow:{draw(c,T,si,p,now,o){EXD_flow(c,now,o);}},
cond:{draw(c,T,si,p,now,o){EXD_cond(c,now,o);}},
shunt:{draw(c,T,si,p,now,o){EXD_shunt(c,now,o);}},
mi:{steps(o){const f=(sim.sc.flags||{}),par=!!f.isch,kd=!!f.kd;return[
  {d:3.2,cam:[260,150,1],cap:'관상동맥은 대동맥 뿌리에서 나와 심근에 혈액을 공급합니다'},
  {d:4,cam:[330,120,1.9],cap:kd?'혈관염으로 관상동맥 근위부가 늘어나 동맥류를 만듭니다':par?'플라크와 혈전이 혈관을 심하게 좁힙니다 (완전 폐색은 아님)':'플라크가 파열되고 혈전이 혈관을 완전히 막습니다'},
  {d:4.6,cam:[f.infarct==='inf'?200:300,205,1.7],cap:kd?'동맥류 안 혈류 정체 → 혈전 → 소아 심근경색 위험':par?'가장 안쪽 심근(심내막하)부터 산소가 모자랍니다 → ST 하강':'막힌 곳 아래 심근이 허혈에 빠지고, 안쪽부터 괴사가 번집니다 → ST 상승'},
  {d:3,cam:[260,150,1],cap:kd?'IVIG와 aspirin으로 동맥류 발생을 줄입니다':'Time is muscle: 빨리 열수록 살아남는 심근이 많습니다'}];},
 draw(c,T,si,p,now){
  const f=(sim.sc.flags||{}),par=!!f.isch,kd=!!f.kd,side=f.infarct==='inf'?'rca':'lad',u=(now*.5)%1,k1=si<1?0:si===1?ss(.15,.8,p):1,k2=si<2?0:si===2?p:1;
  const tube=(pts,col,w)=>{pln(c,pts,'rgba(0,0,0,.5)',w+4);pln(c,pts,col,w);};tube([[262,-20],[262,70]],'#c43a45',30);
  const g=c.createRadialGradient(250,140,20,265,170,175);g.addColorStop(0,'#a03a44');g.addColorStop(1,'#54202a');silPath(c);c.fillStyle=g;c.fill();c.strokeStyle='rgba(230,150,155,.55)';c.lineWidth=1.6;c.stroke();
  const lm=[[274,74],[292,92]],lad=[[292,92],[301,130],[296,180],[289,230],[291,272]],d1=[[299,138],[330,162],[346,192]],lcx=[[292,92],[330,96],[366,118],[385,152]],om=[[366,118],[373,160],[363,196]];
  const rca=[[250,74],[205,92],[167,130],[158,172],[177,216],[233,257]],rvb=[[167,130],[197,160],[206,192]],pda=[[233,257],[264,263]];
  const oF=side==='lad'?.2:.28,ves=side==='lad'?lad:rca,oL=plen(ves),oP=pat(ves,oL,oF*oL[oL.length-1]),tc=side==='lad'?[306,214]:[186,214],occ=!kd&&k1>.6&&!par;
  if(k2>0&&!kd){c.save();silPath(c);c.clip();const r=(par?46:58)+56*k2,tg=c.createRadialGradient(tc[0],tc[1],6,tc[0],tc[1],r);
    if(par){tg.addColorStop(0,'rgba(60,40,110,'+.6*k2+')');tg.addColorStop(1,'rgba(60,40,110,0)');}else{tg.addColorStop(0,'rgba(22,14,52,.95)');tg.addColorStop(.6,'rgba(70,24,70,.8)');tg.addColorStop(.86,'rgba(255,60,80,'+(.35+.3*Math.sin(now*5))+')');tg.addColorStop(1,'rgba(255,60,80,0)');}
    c.fillStyle=tg;c.fillRect(0,0,520,300);c.restore();}
  const art=(pts,w,dead,slow)=>{pln(c,pts,'rgba(0,0,0,.55)',w+3);pln(c,pts,dead?'#5b4a5c':'#ff8a66',w,dead?[5,5]:null);if(!dead)fdots(c,pts,slow?(now*.15)%1:u,slow?2:Math.max(2,pts.length),w*.42,'#ffe0d4');};
  const dl=occ&&side==='lad',dr=occ&&side==='rca',sl=par&&k1>.5;
  art(lm,6);art(lcx,5);art(om,3);art(d1,3,dl,sl&&side==='lad');art(rvb,3,dr);art(pda,3,dr);
  [[lad,dl,side==='lad'],[rca,dr,side==='rca']].forEach(([pp,dead,me])=>{if(!dead){art(pp,5.5,false,sl&&me);return;}pln(c,pp,'rgba(0,0,0,.55)',8.5);pln(c,pp,'#5b4a5c',5.5,[5,5]);ppart(c,pp,0,oF,'#ff8a66',5.5);fdots(c,pp,u,3,2.4,'#ffe0d4',0,oF);});
  if(kd){[[296,104],[262,84]].forEach(q=>{c.fillStyle='#ff6a55';c.strokeStyle='rgba(0,0,0,.5)';c.lineWidth=2;c.beginPath();c.arc(q[0],q[1],4+9*k1,0,TAU);c.fill();c.stroke();if(k2>0){c.fillStyle='rgba(90,15,26,'+k2+')';c.beginPath();c.arc(q[0]+1,q[1]+1,7*k2,0,TAU);c.fill();}});}
  else if(k1>0){c.fillStyle='#e9c96c';c.beginPath();c.ellipse(oP[0]+3,oP[1],4,5*k1,0,0,TAU);c.fill();c.fillStyle='#5a0f1a';c.beginPath();c.arc(oP[0]-1,oP[1],(par?2.2:3.6)*k1,0,TAU);c.fill();if(occ)cross(c,oP[0],oP[1],8,now);}
  echip(c,312,84,'LMCA','#ffb59c');echip(c,282,190,'LAD','#ffb59c','r');echip(c,400,200,'LCx','#ffb59c');echip(c,146,206,'RCA','#ffb59c','r');
  if(k2>.3&&!kd)echip(c,tc[0],tc[1]+34,par?'심내막하 허혈':'허혈 심근 · 수축 저하','#ff9aa3','c');
 }},
pci:{steps(){return[{d:2.4,cam:[260,140,1],cap:'플라크가 내강을 좁혀 혈류가 줄어든 상태입니다'},{d:2.2,cam:[230,140,1.15],cap:'가이드와이어가 병변을 지나 길을 만듭니다'},{d:1.8,cam:[262,140,1.4],cap:'풍선 카테터를 와이어 위로 병변까지 진행합니다'},
  {d:3.6,cam:[270,140,1.75],cap:'풍선이 플라크를 벽으로 밀어내고 스텐트가 펴집니다'},{d:2.2,cam:[270,140,1.4],cap:'풍선을 빼도 스텐트가 내강을 받칩니다'},{d:3.2,cam:[260,140,1],cap:'혈류 회복 (TIMI 3) · 이후 이중 항혈소판 요법 유지'}];},
 draw(c,T,si,p,now){
  const cy=140,H0=36,amp=si<3?25:si===3?25-20*ss(0,.7,p):5,lum=x=>H0-amp*gs(x,270,46);
  const wg=c.createLinearGradient(0,cy-52,0,cy+52);wg.addColorStop(0,'#8a3a44');wg.addColorStop(.5,'#5a1f28');wg.addColorStop(1,'#8a3a44');c.fillStyle=wg;c.fillRect(-200,cy-H0-13,920,(H0+13)*2);
  c.beginPath();for(let x=-200;x<=720;x+=4)x===-200?c.moveTo(x,cy-lum(x)):c.lineTo(x,cy-lum(x));for(let x=720;x>=-200;x-=4)c.lineTo(x,cy+lum(x));c.closePath();
  const lg=c.createLinearGradient(0,cy-H0,0,cy+H0);lg.addColorStop(0,'#a82632');lg.addColorStop(.5,'#e04a55');lg.addColorStop(1,'#a82632');c.fillStyle=lg;c.fill();
  for(const s of[-1,1]){c.beginPath();c.moveTo(170,cy+s*H0);for(let x=170;x<=370;x+=4)c.lineTo(x,cy+s*lum(x));c.lineTo(370,cy+s*H0);c.closePath();c.fillStyle='#e9c96c';c.fill();c.strokeStyle='#fff3c4';c.lineWidth=1;c.stroke();
    c.fillStyle='#c79a3c';c.beginPath();c.ellipse(270,cy+s*(H0-amp*.42),30,Math.max(1.5,amp*.3),0,0,TAU);c.fill();}
  const blocked=si===3||si===4,sp=si<3?.2:blocked?.1:.65,u=(now*sp)%1;
  for(let j=0;j<34;j++){const x=-40+((u+j/34)%1)*600,yy=(hsh(j,3)*2-1)*.72;if(si<3&&x>300&&j%3)continue;if(blocked&&x>214)continue;gdot(c,x,cy+yy*lum(x),2.6,'#ffd9d2');}
  const wt=si===0?-300:si===1?-40+560*ss(0,.9,p):si<5?520:520-600*ss(0,.5,p);if(wt>-200)pln(c,[[-200,cy],[wt,cy]],'#e8eef4',1.6);
  const bx=si<2?-400:si===2?-80+350*ss(0,.95,p):si===3?270:si===4?270-500*ss(.35,1,p):-400,bh=si===3?5+26*ss(0,.7,p):si===4?31-26*ss(0,.3,p):5,sh=si<3?0:si===3?bh:31;
  if(sh>6){c.strokeStyle='#e4edf5';c.lineWidth=1.4;c.beginPath();for(let x=216;x<324;x+=12){c.moveTo(x,cy-sh);c.lineTo(x+6,cy+sh);c.lineTo(x+12,cy-sh);c.moveTo(x,cy+sh);c.lineTo(x+6,cy-sh);c.lineTo(x+12,cy+sh);}c.moveTo(216,cy-sh);c.lineTo(324,cy-sh);c.moveTo(216,cy+sh);c.lineTo(324,cy+sh);c.stroke();}
  if(bx>-300){pln(c,[[-200,cy],[bx-58,cy]],'#7fb6d6',3.4);c.fillStyle='rgba(159,232,255,.28)';rrect(c,bx-58,cy-bh,116,bh*2,Math.min(bh,14));c.fill();c.strokeStyle='rgba(190,240,255,.95)';c.lineWidth=1.6;c.stroke();}
  etx(c,270,cy+H0+26,'플라크 (지질핵 + 섬유막)','#ffcf70',11,'center');etx(c,60,cy-H0-24,'혈류 →','#ffb0a8',11.5,'left','600');
 }},
shock:{steps(o){const a={vf:'심실 전체가 무질서하게 흥분해 떨기만 합니다 → 박출 없음',af:'심방이 무질서하게 흥분하고, 심실은 불규칙하게 뜁니다',afl:'우심방 안에서 재진입 회로가 계속 돕니다',vt:'심실의 이소성 초점·회로가 빠르게 심실을 몰아갑니다'}[o.from];
  const stb=o.from==='af'||o.from==='afl';return[{d:stb?5:3.4,cam:[260,150,1],cap:stb?'안정 시엔 rate control·항응고가 먼저 — 아래는 불안정(저혈압·쇼크·흉통·심부전)할 때의 처치':a},{d:2.8,cam:[260,150,1.06],cap:o.sync?'패드 부착 · 충전 · R파에 동기화 (sync) — T파에 충격이 가면 VF 위험':'즉시 CPR, 패드 부착 · 충전 — 동기화 없이 바로 제세동'},
  {d:1.1,cam:[260,150,1.14],cap:'방전: 심근 전체를 한꺼번에 탈분극시킵니다'},{d:1.7,cam:[260,150,1.06],cap:'모든 세포가 동시에 불응기 → 무질서한 회로가 끊깁니다'},{d:4.6,cam:[260,150,1],cap:'동방결절이 다시 주도권을 잡아 동리듬이 돌아옵니다'}];},
 draw(c,T,si,p,now,o,st){
  heartBase(c,{lv:0,rv:0,at:0,dim:1});condDim(c);const t0=st[2].t0,t4=st[4].t0;
  if(si<2){if(o.from==='vf')sparks(c,now,'v');else if(o.from==='af'){sparks(c,now,'a');if(hsh(Math.floor(now*2.2),5)>.4)sinusBeat(c,clamp(((now*2.2)%1)*.6+.36,0,1),1);}
    else if(o.from==='afl'){c.strokeStyle='rgba(255,179,71,.6)';c.lineWidth=2;c.beginPath();c.ellipse(190,118,28,20,0,0,TAU);c.stroke();const a=now*9;gdot(c,190+28*Math.cos(a),118+20*Math.sin(a),4.5,EY);}
    else focusRings(c,350,215,(now*2.6)%1);}
  if(si>=1&&si<=3){for(const q of[[118,62,-.5],[412,246,-.5]]){c.save();c.translate(q[0],q[1]);c.rotate(q[2]);c.fillStyle='#2c3948';c.strokeStyle='#8fa3b5';c.lineWidth=1.5;rrect(c,-30,-20,60,40,8);c.fill();c.stroke();etx(c,0,0,'PAD','#8fa3b5',10,'center','600');c.restore();}
    const ch=si===1?p:1;c.fillStyle='rgba(255,255,255,.1)';rrect(c,392,22,110,9,4.5);c.fill();c.fillStyle=ch<1?'#ffcf70':'#7cf5a6';rrect(c,392,22,110*ch,9,4.5);c.fill();etx(c,502,42,ch<1?'충전 중':'충전 완료','#cfe3ee',10.5,'right');}
  if(si===2){const a=(1-p)*(1-p);c.save();c.globalAlpha=a;const fg=c.createRadialGradient(265,160,10,265,160,260);fg.addColorStop(0,'#ffffff');fg.addColorStop(.4,'#9fdcff');fg.addColorStop(1,'rgba(159,220,255,0)');c.fillStyle=fg;c.fillRect(-100,-100,720,540);c.restore();
    c.save();c.globalAlpha=a;c.strokeStyle='#e8f6ff';c.lineWidth=2.4;c.shadowColor='#9fdcff';c.shadowBlur=14;for(let k=0;k<3;k++){c.beginPath();c.moveTo(118,62);for(let i=1;i<10;i++)c.lineTo(118+294*i/10+(hsh(i+k*7,Math.floor(now*30))-.5)*46,62+184*i/10+(hsh(i+k*3,Math.floor(now*30)+9)-.5)*46);c.lineTo(412,246);c.stroke();}c.restore();}
  if(si===4)sinusBeat(c,(p*4.6*.95)%1);
  const fn=t=>t<t0?W_[o.from](t):t<t0+.12?1.6*gs(t,t0+.05,.02):t<t4?0:W_.sin(t-t4,.97);
  const marks=[];if(o.sync&&si===1&&o.from!=='vf'){for(let k=0;k<12;k++)marks.push(Math.floor(T/.4)*.4-k*.4+.1);}
  tStrip(c,T,fn,marks);
 }},
adeno:{steps(){return[{d:3.6,cam:[258,150,1.9],cap:'AV node 안의 느린 길과 빠른 길 사이에서 흥분이 계속 돕니다 (재진입)'},{d:3.2,cam:[215,92,1.45],cap:'adenosine 6 mg 급속 정주 + 식염수 flush — 반감기가 10초 미만이라 빠르게 밀어 넣습니다'},
  {d:2.8,cam:[258,150,1.9],cap:'AV node 전도를 몇 초간 차단 → 회로가 끊깁니다 (잠깐의 무수축은 정상 반응)'},{d:4.4,cam:[260,150,1],cap:'동방결절이 다시 주도 → 동리듬 회복. 실패하면 12 mg, 불안정하면 동기화 심율동전환'}];},
 draw(c,T,si,p,now,o,st){
  heartBase(c,{lv:0,rv:0,at:0,dim:1});condDim(c);const t2=st[2].t0,t3=st[3].t0;
  if(si<2||(si===2&&p<.25)){const a=now*17,al=si===2?1-p/.25:1;c.save();c.globalAlpha=al;c.strokeStyle='rgba(255,179,71,.8)';c.lineWidth=1.6;c.beginPath();c.ellipse(258,146,11,7.5,0,0,TAU);c.stroke();gdot(c,258+11*Math.cos(a),146+7.5*Math.sin(a),3,EY);
    const cy=(now*3)%1;ppart(c,CP.his,0,clamp(cy/.2,0,1),EY,4);ppart(c,CP.lb,Math.max(0,cy-.3),clamp(cy*1.3,0,1),EY,3);ppart(c,CP.rb,Math.max(0,cy-.3),clamp(cy*1.3,0,1),EY,3);c.restore();}
  if(si===1){const path=[[190,-10],[190,60],[196,100],[230,130],[258,146]];pln(c,[[190,-10],[190,40]],'rgba(98,214,255,.5)',3);fdots(c,path,0,5,3.2,'#62d6ff',Math.max(0,p-.25),p);echip(c,214,40,'adenosine','#62d6ff');}
  if(si===2){gdot(c,258,146,9,'#62d6ff');cross(c,258,146,7,now);}else gdot(c,258,146,6,si===3?EY:'#ffb347');
  if(si===3)sinusBeat(c,(p*4.4*.95)%1);
  tStrip(c,T,t=>t<t2+.3?W_.svt(t):t<t3?0:W_.sin(t-t3,.97));
 }},
pace:{steps(o){return[{d:3.4,cam:[260,150,1],cap:o.cap0||'심방 신호가 심실로 내려가지 못해 심실이 느리게 뜁니다'},{d:3.8,cam:[215,150,1.35],cap:'경정맥 조율: 전극을 정맥 → 우심방 → 우심실 첨부에 위치시킵니다'},
  {d:4.2,cam:[240,215,1.7],cap:'전기 자극(pacing spike)이 심실을 포획(capture)합니다 → 넓은 QRS'},{d:3.6,cam:[260,150,1],cap:'설정한 심박수로 심실이 뜁니다. 응급에서는 가슴 패드로 하는 경피 조율이 같은 원리입니다'}];},
 draw(c,T,si,p,now,o,st){
  heartBase(c,{lv:0,rv:0,at:0,dim:1});condDim(c);const t2=st[2].t0,LP=[[190,-10],[190,100],[204,150],[232,215],[258,252]];
  const cyc=(now*(o.slowA?.5:1.1))%1,pA=clamp(cyc/.3,0,1);
  if(!o.noA){CP.inod.forEach(q=>ppart(c,q,Math.max(0,pA-.35),pA,EY,3));gdot(c,CP.sa[0],CP.sa[1],cyc<.1?8:5.5,EY);}
  if(o.blk!==0){gdot(c,258,146,6,'#ff4a58');cross(c,258,162,6,now);}else gdot(c,258,146,6,EY);
  if(si>=1){const g=si===1?ss(0,.9,p):1;pln(c,[[190,-10],[190,-9]],'#cfd8e0',2.4);ppart(c,LP,0,g,'#dfe8f0',2.6);const L=plen(LP),tip=pat(LP,L,g*L[L.length-1]);gdot(c,tip[0],tip[1],3.5,'#ffffff');}
  if(si>=2){const q=((T-t2)%.85)/.85;if(q<.7)focusRings(c,258,252,q/.7,true);if(q<.5){c.save();c.globalAlpha=.3*Math.sin(Math.PI*q/.5);c.fillStyle=EY;rvPath(c);c.fill();lvPath(c);c.fill();c.restore();}if(q<.12)gdot(c,258,252,8,'#ffffff');}
  else if(si<2&&o.blk!==0){const q=(now*.5)%1;if(q<.5)focusRings(c,262,200,q/.5);}
  tStrip(c,T,t=>t<t2?(o.blk===0?W_.sin(t,1.4):W_.brady(t)):W_.pace(t-t2));
 }},
hf:{steps(){const pe=!!(sim.sc.flags||{}).pedema;return[{d:3.8,cam:[300,172,1.3],cap:pe?'좌심실이 갑자기 높아진 압력(후부하)을 이기지 못합니다':'좌심실이 늘어나고 수축력이 떨어져 박출률(EF)이 낮아집니다'},
  {d:3.8,cam:[378,116,1.55],cap:'앞으로 못 나간 혈액이 좌심방 → 폐정맥으로 밀려 압력이 오릅니다'},{d:4.4,cam:[440,168,1.75],cap:'폐모세혈관에서 물이 새어 폐포를 채웁니다 → 폐부종, 저산소'},
  {d:5,cam:[440,168,1.75],cap:'치료: 양압환기가 물을 밀어내고, nitroglycerin·이뇨제가 폐정맥 압력을 낮춥니다'},{d:2.6,cam:[260,150,1],cap:'전부하·후부하를 줄여 좌심실의 부담을 덜어 줍니다'}];},
 draw(c,T,si,p,now){
  const b=Math.pow(Math.max(0,Math.sin(now*TAU*1.5)),2),cong=si===0?0:si===1?p:si<3?1:si===3?1-.6*p:.4;
  heartBase(c,{lv:-.13+.07*b,rv:.5*b,at:-.14*cong,mv:b>.3?0:1,tv:b>.3?0:1,av:b>.3?1:0,pv:b>.3?1:0});
  if(cong>0){pln(c,HP.pv1,'rgba(240,96,112,'+.7*cong+')',11+6*cong);pln(c,HP.pv2,'rgba(240,96,112,'+.7*cong+')',11+6*cong);}
  fdots(c,HP.pv1,(now*.18)%1,3,2.8,'#ffb0a8');fdots(c,HP.pv2,(now*.18+.5)%1,3,2.8,'#ffb0a8');fdots(c,HP.svc,(now*.5)%1,3,3,'#9cc0ff');
  if(b>.3){fdots(c,[[308,214],[280,172]].concat(HP.ao),(now*1.1)%1,3,3,'#ffb0a8');fdots(c,[[224,206],[244,170]].concat(HP.pa),(now*1.4)%1,7,3.2,'#a9c8ff');}
  etx(c,190,112,'RA','#fff',13,'center','600');etx(c,326,108,'LA','#fff',13,'center','600');etx(c,212,196,'RV','#fff',14,'center','600');etx(c,320,204,'LV','#fff',14,'center','600');
  if(si===0)echip(c,330,246,'EF 감소 · 약한 박출','#ff9aa3','c');if(si===1)echip(c,410,74,'폐정맥 울혈 (압력 ↑)','#ff9aa3','c');
  const lvl=si<2?0:si===2?p:si===3?1-.85*ss(.1,1,p):.15,ax=452,ay=186;
  if(si>=1){c.fillStyle='rgba(6,12,20,.82)';c.strokeStyle='rgba(255,255,255,.45)';c.lineWidth=1.3;c.beginPath();c.arc(ax,ay,56,0,TAU);c.fill();c.stroke();
    c.save();c.beginPath();c.arc(ax,ay,55,0,TAU);c.clip();
    c.strokeStyle='#d63a4a';c.lineWidth=7;c.beginPath();c.arc(ax,ay,49,0,TAU);c.stroke();fdots(c,bz([ax-49,ay],[ax-49,ay-66],[ax+49,ay-66],[ax+49,ay],20),(now*.25)%1,5,2.2,'#ffd0c8');
    [[-17,-13],[17,-13],[0,14],[-27,18],[27,18]].forEach((q,i)=>{const x=ax+q[0],y=ay+q[1],r=i<3?17:11;c.save();c.beginPath();c.arc(x,y,r,0,TAU);c.clip();c.fillStyle='#16222e';c.fillRect(x-r,y-r,2*r,2*r);
      const top=y+r-2*r*lvl;c.beginPath();c.moveTo(x-r,y+r);for(let k=0;k<=8;k++)c.lineTo(x-r+k*r/4,top+1.6*Math.sin(now*4+k+i));c.lineTo(x+r,y+r);c.closePath();c.fillStyle='rgba(98,170,255,.8)';c.fill();c.restore();
      c.strokeStyle='#ffb7c0';c.lineWidth=1.6;c.beginPath();c.arc(x,y,r,0,TAU);c.stroke();if(lvl<.4)gdot(c,x+5*Math.sin(now*3+i),y-4+3*Math.cos(now*2.3+i),1.8,'#8ff0ff');});
    if(si===3){for(let k=0;k<3;k++){const yy=ay-50+((now*40+k*14)%40);c.strokeStyle='rgba(143,240,255,'+(1-((now*40+k*14)%40)/40)+')';c.lineWidth=2;c.beginPath();c.moveTo(ax-8,yy-5);c.lineTo(ax,yy);c.lineTo(ax+8,yy-5);c.stroke();}}
    c.restore();etx(c,ax,ay+68,si===3?'양압 → 물이 빠짐':lvl>.5?'폐포에 물이 참':'폐포 (확대)','#cfe3ee',10.5,'center','600');}
 }}
};
const PACE0={sbrady:{blk:0,slowA:1,cap0:'동방결절이 느리게 발화해 심박출량이 부족합니다'},junc:{blk:0,noA:1,cap0:'동방결절 대신 접합부가 느리게 박동을 만듭니다'}};
const EXMAP={nsr:{m:'flow'},stach:{m:'cond'},af:{m:'cond',t:'shock',to:{from:'af',sync:1},tn:'불안정 시 · 동기화 심율동전환'},afl:{m:'cond',t:'shock',to:{from:'afl',sync:1},tn:'불안정 시 · 동기화 심율동전환'},
 svt:{m:'cond',t:'adeno',tn:'치료 · adenosine'},vt:{m:'cond',t:'shock',to:{from:'vt',sync:1},tn:'치료 · 동기화 심율동전환'},tdp:{m:'cond',t:'shock',to:{from:'vf',sync:0},tn:'치료 · 제세동'},
 sbrady:{m:'cond',t:'pace',to:PACE0.sbrady,tn:'치료 · 심박조율'},junc:{m:'cond',t:'pace',to:PACE0.junc,tn:'치료 · 심박조율'},avb1:{m:'cond'},wb:{m:'cond'},m2:{m:'cond',t:'pace',to:{},tn:'치료 · 심박조율'},chb:{m:'cond',t:'pace',to:{},tn:'치료 · 심박조율'},
 lbbb:{m:'cond'},rbbb:{m:'cond'},pvc:{m:'cond'},isch:{m:'mi',t:'pci',tn:'시술 · PCI'},stA:{m:'mi',t:'pci',tn:'시술 · PCI'},stI:{m:'mi',t:'pci',tn:'시술 · PCI'},hk:{m:'cond'},hf:{m:'hf'},pedema:{m:'hf'},
 vf:{m:'cond',t:'shock',to:{from:'vf',sync:0},tn:'치료 · 제세동'},pea:{m:'flow'},asys:{m:'cond'},vsd:{m:'shunt'},asd:{m:'shunt'},pda:{m:'shunt'},tof:{m:'shunt'},hcm:{m:'flow'},kd:{m:'mi'}};
const exC=$('exC'),ec=exC.getContext('2d');let exOn=false,exRun=false,exPage='m',exT0=0,exDemo=0;
function openExpl(page){
  const cfg=EXMAP[sim.sc.id]||{m:'flow'};exPage=page==='t'&&cfg.t?'t':'m';exOn=true;exT0=performance.now()/1000;
  $('expl').classList.add('on');$('exT').textContent=sim.sc.name;const pg=$('exTopics');pg.innerHTML='';
  [['m','기전 · 무슨 일이 일어나나'],['t',cfg.tn||'치료']].forEach(([k,nm])=>{if(k==='t'&&!cfg.t)return;const b=document.createElement('button');b.type='button';b.className='ib';b.textContent=nm;b.setAttribute('aria-pressed',k===exPage);b.addEventListener('click',()=>openExpl(k));pg.appendChild(b);});
  $('exD').innerHTML=exPage==='m'?sim.sc.heart:'<ul>'+sim.sc.er.slice(0,4).map(x=>'<li>'+x+'</li>').join('')+'</ul>';
  exC.width=Math.max(1,exC.clientWidth*dpr);exC.height=Math.max(1,exC.clientHeight*dpr);exLoop();
}
function exLoop(){if(!exOn||exRun)return;exRun=true;const step=()=>{if(!exOn){exRun=false;return;}drawEx(performance.now()/1000);requestAnimationFrame(step);};step();}
$('exX').addEventListener('click',()=>{exOn=false;$('expl').classList.remove('on');});
exC.addEventListener('click',()=>{exDemo++;});
const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
function drawEx(now){
  const W=exC.clientWidth,H=exC.clientHeight,c=ec,cfg=EXMAP[sim.sc.id]||{m:'flow'},nm=exPage==='t'?cfg.t:cfg.m,o=(exPage==='t'?cfg.to:cfg.mo)||{},S=SC2[nm];
  c.setTransform(dpr,0,0,dpr,0,0);const g0=c.createLinearGradient(0,0,0,H);g0.addColorStop(0,'#0c1826');g0.addColorStop(1,'#03060a');c.fillStyle=g0;c.fillRect(0,0,W,H);
  const s=Math.min(W/520,H/340);c.save();c.translate((W-520*s)/2,(H-340*s)/2);c.scale(s,s);c.lineJoin='round';c.lineCap='round';c.textBaseline='middle';c.textAlign='left';
  if(!S.steps){S.draw(c,0,0,0,now,o);c.restore();return;}
  const st=S.steps(o);let tot=0;st.forEach(x=>{x.t0=tot;tot+=x.d;});const T=(now-exT0)%tot;let si=0;while(si<st.length-1&&T>=st[si].t0+st[si].d)si++;
  const loc=T-st[si].t0,p=loc/st[si].d,a=st[(si+st.length-1)%st.length].cam,b=st[si].cam,e=ease(clamp(loc/1.1,0,1)),cx=a[0]+(b[0]-a[0])*e,cy=a[1]+(b[1]-a[1])*e,z=a[2]+(b[2]-a[2])*e;
  c.save();c.beginPath();c.rect(0,0,520,296);c.clip();c.translate(260,148);c.scale(z,z);c.translate(-cx,-cy);S.draw(c,T,si,p,now,o,st);c.restore();
  const vg=c.createRadialGradient(260,148,120,260,148,330);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.55)');c.fillStyle=vg;c.fillRect(0,0,520,296);
  c.fillStyle='#03060a';c.fillRect(0,296,520,44);c.strokeStyle='rgba(120,190,220,.2)';c.lineWidth=1;c.beginPath();c.moveTo(0,296.5);c.lineTo(520,296.5);c.stroke();
  c.globalAlpha=clamp(loc/.5,0,1);const cap=st[si].cap;c.font='500 12.5px "IBM Plex Sans KR",sans-serif';let fz=12.5;while(c.measureText(cap).width>500&&fz>9){fz-=.5;c.font='500 '+fz+'px "IBM Plex Sans KR",sans-serif';}
  c.textAlign='center';c.fillStyle='#eef4f8';c.fillText(cap,260,313);c.textAlign='left';c.globalAlpha=1;
  const w=8,gap=6,x0=260-(st.length*(w+gap)-gap)/2;st.forEach((x,i)=>{c.fillStyle=i===si?'#57d3e6':i<si?'rgba(87,211,230,.45)':'rgba(255,255,255,.16)';rrect(c,x0+i*(w+gap),329,i===si?w+10*p:w,4,2);c.fill();});
  c.restore();
}
const CAV=`<section><h3>실측 기록 주의 · Real-data caveats</h3><ul>
<li>실측 기록은 시나리오 설명과 다를 수 있습니다. 예: 전벽 STEMI 기록은 초급성기가 아니라 급성~아급성 경과입니다. 파형은 실제 기록이고, 설명은 교과서적 대표 소견입니다.</li>
<li>초급성 STEMI, Mobitz II, VT, Torsades, VF, PEA, 무수축, 고칼륨혈증, 소아 질환은 적합한 공개 기록이 없어 합성 파형만 제공합니다.</li>
<li>실측 ECG는 시술 전 기록 그대로입니다. 재관류 후 ST 변화는 반영되지 않습니다.</li>
<li>완전 방실차단 실측은 P파 위치를 추정한 값입니다. Mobitz I은 P파 자동 검출이 불안정해 실측에서 제외했습니다.</li>
<li>실측 기록은 PTB-XL 환자들의 것이며, 화면의 환자 상태·검사 수치와 연결되지 않습니다.</li>
</ul></section>
<section><h3>일반 주의 · General caveats</h3><ul>
<li>교육용 시뮬레이션입니다. 실제 진료 판단과 환자 치료에 사용하지 마세요.</li>
<li>3D 모형은 BodyParts3D 성인 남성 1인 해부를 바탕으로 하며, 대혈관은 단순화했습니다. 판막 4개는 실제 판륜 위치·크기에 맞춘 판엽 모형(판륜·건삭 포함)입니다.</li>
<li>소아 질환(VSD, ASD, PDA, TOF, HCM, 가와사키)은 소아 모형이 아니라 성인 모형에 결손 위치와 혈류를 도식으로 얹은 것입니다.</li>
<li>색은 관례 표시입니다. 빨강은 동맥혈, 파랑은 정맥혈을 뜻하며 실제 혈액 색이 아닙니다.</li>
<li>해설(2D) 화면은 개념 이해용으로 단순화했습니다.</li>
<li>검사 수치와 환자 상태는 가상 증례입니다. 검사실 참고치는 기관마다 다릅니다.</li>
<li>합성 파형은 리듬 특징을 수식으로 만든 것이며 실제 환자 기록이 아닙니다.</li>
<li>약물 용량은 성인 ACLS 요약입니다. 기관 프로토콜과 최신 가이드라인을 우선하세요.</li>
</ul></section>
<section><h3>라이선스 · License</h3><p class="note">3D 해부 모델: BodyParts3D © DBCLS, CC BY-SA 2.1 JP (파생물도 동일 조건). 심전도: PTB-XL v1.0.3, PhysioNet, CC BY 4.0.</p></section>`;

/* ───────────── 7. 프레임 루프 ───────────── */
let prevC=[0,0],prevA=0,last=performance.now(),hudT=0,slow=0;
const WAVE=(k,org,tau,sp,pl)=>{SU.uOrg.value[k].copy(org);SU.uWave.value[k]=tau>=0&&tau*sp<4.5?tau*sp:-9;SU.uPlat.value[k]=pl;};
const WIN={inod:[0,.07],bach:[.01,.065],his:[-.065,-.03],lbb:[-.03,.008],rbb:[-.03,.008],purkL:[.008,.065],purkR:[.008,.065]};
function frame(now){
  requestAnimationFrame(frame);
  const real=Math.min(.05,(now-last)/1000);last=now;const dt=paused?0:real*speed;
  sim.t+=dt;const t=sim.t,sc=sim.sc,f=sc.flags||{};
  let guard=0;while(sim.s.t<t+1.5&&guard++<60){if(sim.src==='real')realStep(sim.s);else sc.step(sim.s);}
  if(sim.V.length>160)sim.V.splice(0,60);if(sim.P.length>200)sim.P.splice(0,80);
  sample();perf+=(perfT-perf)*Math.min(1,dt*.8);

  const L=ventState(t,0),R=ventState(t,1),aC=f.afib||f.flutter?0:atrialC(t),S=[L,R];
  S.forEach((s,i)=>{const d=dt>0?(s.c-prevC[i])/dt:0;s.fill=Math.max(0,-d);s.ej=s.ej?Math.max(0,d):0;s.kick=dt>0?Math.max(0,(aC-prevA)/dt)*.12:0;s.semiOpen=s.ej>0||(s.c>.5&&!s.avOpen&&d>-1);if(dt>0)prevC[i]=s.c;});
  if(dt>0)prevA=aC;
  const C=SU.uC.value;C[0]=L.c;C[1]=R.c;C[2]=aC-.35*L.c;C[3]=aC-.35*R.c;
  SU.uQv.value.set(f.vfib?1:0,f.afib?.8:(f.flutter?.3:0));SU.uT.value=t;SU.uGlow.value=vm==='flow'?0:1;
  const idle=perf<.12&&L.c<.02,k=Math.min(1,real*26);
  if(dt>0){vOpen.mv.value+=((idle?.4:(L.avOpen?(.6+.4*clamp(L.fill*.4+L.kick*2,0,1)):0))-vOpen.mv.value)*k;
  vOpen.tv.value+=((idle?.4:(R.avOpen?(.6+.4*clamp(R.fill*.4+R.kick*2,0,1)):0))-vOpen.tv.value)*k;
  vOpen.pv.value+=((R.semiOpen?1:0)-vOpen.pv.value)*k;aoValve.set(L.semiOpen?1:0,real);}
  if((ly.flow&&vm!=='elec')&&dt>0)stepParticles(dt,S);

  // 전기 흥분 파면
  const ev=lastEv(sim.V,t,-.08,.9),pe=lastEv(sim.P,t,0,.45);
  const ch=SU.uChaos.value;ch[0]=ch[1]=f.vfib?1:0;ch[2]=ch[3]=f.afib?.8:(f.flutter?.25:0);
  focL.visible=focR.visible=false;
  if(ev){
    const tau=t-ev.t,pl=1-ss(.75*ev.qt,ev.qt+.02,tau),slowAll=ev.m==='hk';
    if(ev.org==='lv'){WAVE(0,ORG.lvFoc,tau,12,pl);WAVE(1,ORG.rvSept,tau-.06,12,pl);if((ly.cond&&vm!=='flow')&&tau>-.02&&tau<.15){focL.visible=true;focL.material.opacity=1-Math.max(0,tau)/.15;deformPt(focL.userData.base,focL.position);}}
    else if(ev.org==='rv'){WAVE(1,ORG.rvFoc,tau,12,pl);WAVE(0,ORG.lvSept,tau-.06,12,pl);if((ly.cond&&vm!=='flow')&&tau>-.02&&tau<.15){focR.visible=true;focR.material.opacity=1-Math.max(0,tau)/.15;deformPt(focR.userData.base,focR.position);}}
    else{
      if(f.lbb)WAVE(0,ORG.lvSept,tau-.045,11,pl);else WAVE(0,ORG.lvN,tau-ev.lvD*.5,slowAll?13:27,pl);
      if(f.rbb)WAVE(1,ORG.rvSept,tau-.045,11,pl);else WAVE(1,ORG.rvN,tau-ev.rvD*.5,slowAll?13:27,pl);
    }
  }else{WAVE(0,ORG.lvN,-1,1,0);WAVE(1,ORG.rvN,-1,1,0);}
  if(pe&&pe.kind==='sinus'){const tau=t-pe.t;WAVE(3,ORG.ra,tau,15,1-ss(.12,.22,tau));WAVE(2,ORG.la,tau-.025,15,1-ss(.14,.24,tau));}
  else if(pe){const tau=t-pe.t;WAVE(3,ORG.avn,tau,15,0);WAVE(2,ORG.avn,tau,15,0);}
  else{WAVE(2,ORG.la,-1,1,0);WAVE(3,ORG.ra,-1,1,0);}

  // 전도계 펄스
  if((ly.cond&&vm!=='flow')){
    for(const o of cond){
      const w=WIN[o.key];let p=-1;
      if(o.key==='inod'||o.key==='bach'){const e=lastEv(sim.P,t,w[0],w[1],x=>x.kind==='sinus');if(e)p=(t-e.t-w[0])/(w[1]-w[0]);}
      else{const blocked=(f.lbb&&(o.key==='lbb'||o.key==='purkL'))||(f.rbb&&(o.key==='rbb'||o.key==='purkR'));
        const e=blocked?null:lastEv(sim.V,t,w[0],w[1],x=>x.org==='his'||x.org==='junc');if(e)p=(t-e.t-w[0])/(w[1]-w[0]);}
      if(p>=0&&p<=1){o.curve.getPoint(p,tmp);deformPt(tmp,o.dot.position);o.dot.visible=true;o.lit=1;}else{o.dot.visible=false;o.lit=Math.max(0,o.lit-dt*7-(paused?0:real*.5));}
      if((f.lbb&&(o.key==='lbb'||o.key==='purkL'))||(f.rbb&&(o.key==='rbb'||o.key==='purkR')))o.mat.color.setRGB(.85,.12,.18);else o.mat.color.setRGB(.28+.62*o.lit,.33+.67*o.lit,.08+.27*o.lit);
    }
    const sa=lastEv(sim.P,t,-.01,.06,x=>x.kind==='sinus');saNode.material.color.setHex(sa?0xcfe04a:0x7a6f26);saNode.scale.setScalar(sa?1.3:1);
    const hold=lastEv(sim.P,t,.065,.4,x=>x.kind==='sinus'&&!x.blocked&&t-x.t<x.pr-.03),blk=lastEv(sim.P,t,.065,.3,x=>x.blocked);
    avNode.material.color.setHex(blk?0xff3b4a:hold?0xffb347:(f.avnrt?0xffb347:0x8a7a2a));avNode.scale.setScalar(blk||hold?1.45:1);
    deformPt(saNode.userData.base,saNode.position);deformPt(avNode.userData.base,avNode.position);
    if(blkL.visible)deformPt(blkL.userData.base,blkL.position);if(blkR.visible)deformPt(blkR.userData.base,blkR.position);
    if(f.flutter){const a=-TAU*((t*(sim.src==='real'?sim.loopHz*2:5))%1);flDot.position.set(.5*Math.cos(a),.5*Math.sin(a),0);}
    if(f.avnrt){const a=TAU*((t*sim.loopHz)%1);avDot.position.set(.13*Math.cos(a),.13*Math.sin(a),0);}
  }
  [occLAD,occRCA].forEach(o=>{if(o.visible){o.userData.ring.quaternion.copy(camera.quaternion);o.userData.ring.scale.setScalar(1+.25*Math.sin(now*.006));}});

  // 선택 부위 표지
  if(sel){deformPt(sel.local,tmp).project(camera);const w=view.clientWidth,h=view.clientHeight;call.style.transform='translate3d('+clamp((tmp.x+1)/2*w,8,w-200).toFixed(1)+'px,'+clamp((1-tmp.y)/2*h,60,h-70).toFixed(1)+'px,0) translate(16px,-50%)';}

  hudT+=real;if(hudT>.12){hudT=0;
    let hr=0;const vs=sim.V.filter(e=>e.t<=t&&e.t>t-7);
    if(vs.length>=2){const n=Math.min(6,vs.length-1);hr=Math.round(60*n/(vs[vs.length-1].t-vs[vs.length-1-n].t));if(t-vs[vs.length-1].t>3.5)hr=0;}
    $('vHR').textContent=f.vfib?'---':(hr||(sc.id==='asys'?'0':'--'));
    let E='이완기 (diastole, isoelectric line)';
    if(f.vfib)E='심실 전체의 무질서한 재진입 (multiple wavelet reentry)';else if(sc.id==='asys')E='전기 활동 없음';
    else if(ev&&t-ev.t>=-.06&&t-ev.t<ev.end)E=ev.org==='lv'||ev.org==='rv'?'심실 이소성 흥분이 근육을 타고 전파 (넓은 QRS)':f.lbb?'우각으로만 전도, 좌심실은 지연 흥분 (QRS)':f.rbb?'좌각으로만 전도, 우심실은 지연 흥분 (QRS)':'His–Purkinje를 통한 심실 탈분극 (ventricular depolarization, QRS)';
    else if(pe&&t-pe.t<.11&&pe.kind==='sinus')E='SA node 발화, 심방 탈분극 (atrial depolarization, P파)';
    else if(pe&&pe.kind==='sinus'&&pe.blocked&&t-pe.t<.3)E='AV 전도 차단: P파가 심실로 전달되지 않음';
    else if(pe&&pe.kind==='sinus'&&t-pe.t<pe.pr)E='AV node 지연 (AV nodal delay, PR 분절)';
    else if(ev&&t-ev.t<ev.qt+.04)E='심실 재분극 (repolarization, ST–T)';
    else if(f.afib)E='심방 내 무질서한 소파동 (f파)';else if(f.flutter)E='우심방 재진입 회로 (조동파)';
    $('hudE').textContent=E;
    let M='심실 충만기 (ventricular filling), 방실판막 열림';
    if(f.vfib)M='심실 세동 (fibrillation): 심근이 떨기만 하고 박출 없음';else if(perf<.12&&L.c<.03)M=sc.id==='pea'?'전기 활동은 있으나 유효 수축 없음':'수축 없음';
    else if(L.ej>0||R.ej>0)M='심실 박출 (ejection), 대동맥·폐동맥판 열림';else if(L.c>.25)M=L.fill>0?'등용적 이완 (isovolumetric relaxation)':'심실 수축 (systole)';
    else if(aC>.3)M='심방 수축 (atrial kick)';else if(f.afib)M='심실 충만기, 심방 수축 소실';
    $('hudM').textContent=M;setPhase(f,ev,pe,L,R,t);
  }
  extrasFrame(real,dt,t,L,R,now);
  controls.update();
  if(ECHO.on)echoRender(real);else if(composer&&glowOn&&theme==='dark'&&!SU.uFlu.value){composer.render();}else renderer.render(scene,camera);
  drawMon();
  // 느린 기기에서는 발광 후처리를 자동으로 끔
  if(composer&&glowOn&&!DBG){slow=real>.045?slow+1:Math.max(0,slow-2);if(slow>90){glowOn=false;$('lyGlow').checked=false;}}
}
/* ───────────── 8. 확장: Purkinje 망, 판막 상태, 위험 표지, 테마, Digital, 시술, 단락 혈류 ───────────── */
const X=HM.land.X,NET=HM.land.net;
// Purkinje 섬유망 (심내막 위 분지 선분)
function mkNet(polys){
  const pos=[];polys.forEach(p=>{for(let i=0;i+1<p.length;i++)pos.push(p[i][0],p[i][1],p[i][2],p[i+1][0],p[i+1][1],p[i+1][2]);});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(new Float32Array(pos.length),3));addW(g);
  const m=new THREE.LineSegments(g,inject(new THREE.LineBasicMaterial({color:0x6b5c1e,clippingPlanes:[clip]}),{lit:false,endo:1}));m.renderOrder=3;m.frustumCulled=false;heart.add(m);return m;
}
const netL=mkNet(NET.L),netR=mkNet(NET.R);
// 판막 개폐 표시 고리
const vRing=(p,n,r)=>{const m=new THREE.Mesh(new THREE.TorusGeometry(r,.016,8,40),new THREE.MeshBasicMaterial({color:0x3ddc84,clippingPlanes:[clip]}));m.position.copy(p);m.quaternion.setFromUnitVectors(new V3(0,0,1),n);m.userData.base=p.clone();m.renderOrder=9;return m;};
const rings={mv:vRing(MVc,uLV,.36),tv:vRing(TVc,uRV,.38),pv:vRing(PVc,nPv,.27),av:vRing(AOc,nAo,.31)};
const ringCol=(m,o)=>m.material.color.setRGB(.95-.72*o,.25+.62*o,.3+.2*o);
const aoMat=vessels[0].material,paMat=vessels[1].material;
aoMat.userData.own.uJo.value.set(AOc.x,AOc.y,AOc.z,-1);paMat.userData.own.uJo.value.set(PVc.x,PVc.y,PVc.z,-1);
let ejT=[-9,-9],ejPrev=[false,false];

// 위험 부위 표지 (HTML 칩)
const tagBox=$('tags');let tags=[];
function setTags(list){tagBox.innerHTML='';tags=list.map(([p,txt,cls])=>{const el=document.createElement('div');el.className='tag'+(cls?' '+cls:'');el.innerHTML='<b></b><small>눌러서 해설 보기</small>';el.firstChild.textContent=txt;el.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();openExpl('m');});tagBox.appendChild(el);return{el,p:Array.isArray(p)?v3(p):p.clone()};});}
const mid=(a,b)=>v3(a).add(v3(b)).multiplyScalar(.5);
const vsdP=mid(LD.lvSept,LD.rvSept),iaP=LAc.clone().add(RAc).multiplyScalar(.5);iaP.addScaledVector(nia,-(iaP.clone().sub(cia).dot(nia)));
const aoL=X.aoL.map(v3);let iArch=0;aoL.forEach((p,i)=>{if(p.y>aoL[iArch].y)iArch=i;});const iDuct=Math.min(aoL.length-2,iArch+3);
const bifP=v3(LD.bif),ductP=aoL[iDuct].clone().lerp(bifP,.5);
function tagsFor(sc){
  const f=sc.flags||{},o=[];
  if(proc.reperf&&f.infarct){const an=f.infarct==='ant';return[[an?LD.ladOcc:LD.rcaOcc,'스텐트 · 재관류 (TIMI 3)','ok'],[an?LD.iscAnt:LD.iscInf,'회복 중인 심근 · stunned myocardium','ok']];}
  if(proc.reperf&&f.isch)return[[LD.ladOcc,'스텐트 · 협착 해소','ok']];
  if(f.infarct==='ant'&&!proc.reperf)o.push([LD.ladOcc,'LAD 폐색 · culprit lesion'],[LD.iscAnt,'허혈 심근 · ischemic myocardium']);
  if(f.infarct==='inf'&&!proc.reperf)o.push([LD.rcaOcc,'RCA 폐색 · culprit lesion'],[LD.iscInf,'허혈 심근 · ischemic myocardium']);
  if(f.lbb)o.push([CD.lbb[0][1],'LBB 전도 차단']);if(f.rbb)o.push([CD.rbb[0][2],'RBB 전도 차단']);
  if(['chb','m2','wb'].includes(sc.id))o.push([LD.AVn,sc.id==='chb'?'완전 AV block':'간헐적 AV block']);
  if(sc.id==='vt')o.push([LD.lvFoc,'이소성 초점 · ectopic focus']);if(sc.id==='pvc')o.push([LD.rvFoc,'PVC 초점 · ectopic focus']);
  if(f.vfib)o.push([LD.lvN,'VF: 박출 없음 · no cardiac output']);
  if(f.shunt==='vsd')o.push([vsdP,'VSD · 좌→우 단락 (L→R shunt)']);
  if(f.shunt==='asd')o.push([iaP,'ASD · 좌→우 단락 (L→R shunt)']);
  if(f.shunt==='pda')o.push([ductP,'PDA · 대동맥→폐동맥 단락']);
  if(f.shunt==='tof')o.push([vsdP,'VSD · 우→좌 단락 (청색증)'],[PVc,'RVOT/폐동맥판 협착 (PS)'],[AOc,'Overriding aorta']);
  if(f.hcm)o.push([LD.lvSept,'비대칭 중격 비후 · ASH'],[mid(LD.lvSept,LD.AOc),'LVOT 폐쇄 · SAM']);
  if(f.kd)o.push([X.LMo,'관상동맥류 · coronary aneurysm'],[X.RCo,'관상동맥류 · coronary aneurysm']);
  if(f.junc)o.push([LD.AVn,'접합부 박동 · junctional']);
  if(f.isch)o.push([LD.ladOcc,'LAD 고도 협착 · 심내막하 허혈']);
  if(f.pedema)o.push([HM.land.ost[0],'폐정맥 울혈 → 폐부종']);if(f.hf)o.push([LD.lvN,'좌심실 수축력 저하 · EF↓']);
  if(f.avnrt)o.push([LD.AVn,'AV node 재진입 회로']);if(f.afib)o.push([CD.bach[0][3],'심방세동 · 무질서한 흥분']);if(f.flutter)o.push([LD.TVc,'심방조동 재진입 회로']);
  if(sc.id==='tdp')o.push([LD.lvFoc,'다형 VT · 초점이 계속 바뀜']);
  if(!o.length)o.push([LD.SA,sc.id==='asys'?'전기 활동 없음':sc.id==='pea'?'전기는 정상 · 수축 없음':'동방결절 · 리듬의 시작점']);
  return o;
}
// 가와사키: 동맥류 구
const anM=new THREE.MeshStandardMaterial({color:0xff5a48,roughness:.3,envMap:envTex,emissive:0x551008});
const aneur=[X.LMo,X.ladWire[3],X.RCo,X.rcaWire[3]].map((p,i)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(i%2?.11:.14,18,14),anM);m.position.copy(v3(p));heart.add(m);return m;});

// 단락 혈류 경로
{const FL=HM.land.F.L[0],FR=HM.land.F.R[0],pl=FL.p.map(v3),pr=FR.p.map(v3),lS=v3(LD.lvSept),rS=v3(LD.rvSept);
 const add=(pts,g,side,src,sh)=>{const n=pts.length-1,rad=pts.map((_,i)=>i<2?.1:(i<g[3]?.2:.14));paths.push({curve:new THREE.CatmullRomCurve3(pts),rad,n,a:g[0]/n,g1:g[1]/n,ap:g[2]/n,g2:g[3]/n,side,src,sh});};
 add(pl.slice(0,5).concat([lS,rS],pr.slice(6)),[1,3,4,9],0,0,'vsd');
 add(pl.slice(0,3).concat([iaP],pr.slice(2)),[1,5,7,10],1,0,'asd');
 add(pl.slice(0,8+iDuct).concat([ductP,bifP],pr.slice(-3)),[1,3,5,7],0,0,'pda');
 add(pr.slice(0,6).concat([rS,lS,pl[6],pl[7]],pl.slice(8)),[1,3,5,9],1,1,'tof');}

// 테마 / Digital 모드
let theme='dark';
const bgTex={};[['dark',['#0b1826','#070e18','#04070c']],['light',['#f4f8fb','#dfe8ef','#c7d4de']],['flu',['#9a9fa3','#84898d','#6c7175']]].forEach(([k,c])=>{
  const cv=document.createElement('canvas');cv.width=16;cv.height=256;const x=cv.getContext('2d'),g=x.createLinearGradient(0,0,0,256);g.addColorStop(0,c[0]);g.addColorStop(.55,c[1]);g.addColorStop(1,c[2]);x.fillStyle=g;x.fillRect(0,0,16,256);bgTex[k]=new THREE.CanvasTexture(cv);});
function applyTheme(){
  document.documentElement.setAttribute('data-theme',theme);
  const flu=SU.uFlu.value>.5;scene.background=bgTex[flu?'flu':theme];
  const add=theme==='dark'&&!flu;heads.material.blending=tails.material.blending=add?THREE.AdditiveBlending:THREE.NormalBlending;heads.material.needsUpdate=tails.material.needsUpdate=true;
  const ca=lCol;for(let i=0;i<NP;i++){const c=i%2?[.22,.45,1]:[1,.26,.16],k=add?.02:.9;ca[i*6]=c[0]*k;ca[i*6+1]=c[1]*k;ca[i*6+2]=c[2]*k;}lGeo.attributes.color.needsUpdate=true;
}

$('tDig').addEventListener('click',()=>{const v=SU.uDig.value<.5;SU.uDig.value=v?1:0;$('tDig').setAttribute('aria-pressed',v);});

/* 시술: CAG / PCI / CABG */
const proc={mode:null,t:0,reperf:false,tgt:'lad',objs:[],flu:true};
const metal=new THREE.MeshStandardMaterial({color:0xcfd8e0,metalness:.9,roughness:.25,envMap:envTex});
const catM=new THREE.MeshStandardMaterial({color:0x2b6cff,roughness:.4,emissive:0x0a2a80});
function pTube(pts,r,mat){const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),pts.length*10,r,8,false),m=new THREE.Mesh(g,mat);m.renderOrder=9;m.frustumCulled=false;m.userData.full=g.index.count;g.setDrawRange(0,0);heart.add(m);proc.objs.push(m);return m;}
const grow=(m,f)=>m.geometry.setDrawRange(0,Math.floor(clamp(f,0,1)*m.userData.full/3)*3);
function procClear(){proc.objs.forEach(m=>{heart.remove(m);m.geometry.dispose();});proc.objs=[];proc.mode=null;proc.t=0;
  ['lad','lcx','rca'].forEach(k=>{const o=corMats[k].userData.own;o.uDye.value.set(0,0,0,0);});setFlu(false);clearTimeout(proc.capT);$('procCap').classList.remove('on');$('tProc').textContent='시술';}
function setFlu(v){SU.uFlu.value=v?1:0;['lad','lcx','rca'].forEach(k=>{corMats[k].depthWrite=!v;});heads.visible=tails.visible=(ly.flow&&vm!=='elec')&&!v;condRoots.forEach(m=>{if(v)m.visible=false;});netL.visible=netR.visible=(ly.cond&&vm!=='flow')&&!v;inner.forEach(m=>{if(v)m.visible=false;});if(v)cors[3].visible=false;tagBox.style.opacity=v?.85:1;if(!v)applyLayers();applyTheme();}
function occOf(){const f=(sim.sc.flags||{}).infarct;return f==='ant'?'lad':f==='inf'?'rca':null;}
function setStops(){const oc=proc.reperf?null:occOf();
  corMats.lad.userData.own.uStop.value=oc==='lad'?v3(X.LMo).distanceTo(v3(LD.ladOcc))+.02:99;corMats.rca.userData.own.uStop.value=oc==='rca'?v3(X.RCo).distanceTo(v3(LD.rcaOcc))+.02:99;corMats.lcx.userData.own.uStop.value=99;}
function procStart(mode){
  const keep=proc.reperf;procClear();proc.reperf=keep;proc.mode=mode;proc.t=0;proc.tgt=occOf()||'lad';setStops();$('procPop').classList.remove('on');$('procCap').classList.add('on');$('tProc').textContent='시술 중';proc.doneShown=false;
  const left=proc.tgt==='lad',ost=v3(left?X.LMo:X.RCo),wire=(left?X.ladWire:X.rcaWire).map(v3),occ=v3(left?LD.ladOcc:LD.rcaOcc);
  proc.cath=pTube(aoL.slice(0,Math.min(aoL.length,30)).reverse().concat([AOc.clone().lerp(ost,.5),ost]),.045,catM);
  proc.ost=ost;proc.occ=occ;proc.left=left;
  if(mode==='pci'){
    proc.wire=pTube([ost].concat(wire),.014,metal);
    const dir=wire[Math.min(wire.length-1,7)].clone().sub(wire[5]).normalize();
    proc.bal=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),new THREE.MeshStandardMaterial({color:0x9fe8ff,transparent:true,opacity:.75,roughness:.2,envMap:envTex,emissive:0x124a5a}));
    proc.bal.position.copy(occ);proc.bal.quaternion.setFromUnitVectors(new V3(0,1,0),dir);proc.bal.visible=false;proc.bal.renderOrder=9;heart.add(proc.bal);proc.objs.push(proc.bal);
    proc.stent=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.34,12,5,true),new THREE.MeshBasicMaterial({color:0xe8f4ff,wireframe:true}));
    proc.stent.position.copy(occ);proc.stent.quaternion.copy(proc.bal.quaternion);proc.stent.visible=false;proc.stent.renderOrder=9;heart.add(proc.stent);proc.objs.push(proc.stent);
  }
  setFlu(proc.flu);
}
function reperfuse(){if(proc.reperf)return;proc.reperf=true;setStops();const k=occOf();if(k)corMats[k].color.setHex(0xff7d5e);sim.stK=.2;applyLayers();setTags(tagsFor(sim.sc));}
function procFinish(){
  const pci=proc.mode==='pci',cap=$('procCap'),oc=occOf(),found=oc&&!proc.reperf&&((oc==='lad')===proc.left);
  proc.objs.forEach(m=>{if(!(pci&&m===proc.stent)){heart.remove(m);if(m.geometry)m.geometry.dispose();}});proc.objs=pci?[proc.stent]:[];
  ['lad','lcx','rca'].forEach(k=>corMats[k].userData.own.uDye.value.set(0,0,0,0));
  proc.mode=null;setFlu(false);$('tProc').textContent='시술';$('tProc').setAttribute('aria-expanded','false');
  cap.textContent=pci?'PCI 완료 · 스텐트 삽입, 혈류 회복 (TIMI 3)':('CAG 완료 · '+(found?(proc.left?'LAD':'RCA')+' 폐색 확인 (TIMI 0)':'관상동맥 정상'));
  cap.classList.add('on');clearTimeout(proc.capT);proc.capT=setTimeout(()=>cap.classList.remove('on'),2800);
}
function procFrame(dt){
  if(proc.reperf&&SU.uIsc.value.w>0)SU.uIsc.value.w=Math.max(0,SU.uIsc.value.w-dt*.25);
  if(!proc.mode)return;proc.t+=dt;const T=proc.t,cap=$('procCap'),oc=occOf(),nm=proc.left?'LAD':'RCA',os=proc.left?'좌주간부(LMCA)':'RCA';
  const say=s=>{if(cap.textContent!==s)cap.textContent=s;};
  const dye=t0=>{const ph=T-t0,fr=ph*1.1+.05;(proc.left?['lad','lcx']:['rca']).forEach(k=>corMats[k].userData.own.uDye.value.set(proc.ost.x,proc.ost.y,proc.ost.z,T>t0?fr:0));return ph;};
  let end=0;
  if(proc.mode==='cag'){
    end=8;grow(proc.cath,T/2.5);
    if(T<2.5)say('① 대퇴/요골동맥 → 대동맥 역행: 진단 카테터를 '+os+' 입구(ostium)에 삽입');
    else{const ph=dye(2.5);say(ph<4?'② 조영제 주입 (혈관이 검게 채워짐): '+(oc&&!proc.reperf&&((oc==='lad')===proc.left)?nm+' 근위부 폐색 → 원위부 조영 안 됨 (TIMI 0)':'관상동맥 전체 조영 (TIMI 3)'):'③ 조영 종료 · 카테터 제거');}
  }else if(proc.mode==='pci'){
    end=11;grow(proc.cath,T/1.5);grow(proc.wire,(T-1.5)/2);
    proc.bal.visible=T>3.5&&T<7.2;proc.stent.visible=T>5;
    if(T>3.5&&T<7.2){const k=T<4.5?.3:(T<6.5?1+.06*Math.sin(T*9):Math.max(.3,1-(T-6.5)*1.4));proc.bal.scale.set(.1*k,.2,.1*k);}
    if(T>5){const k=clamp((T-5)/.8,.45,1);proc.stent.scale.set(k,1,k);}
    if(T>7.2)reperfuse();
    if(T<1.5)say('① 가이딩 카테터를 '+os+' 입구에 삽입');
    else if(T<3.5)say('② 가이드와이어로 병변 통과 (wire crossing)');
    else if(T<5)say('③ 풍선 확장 (POBA): 혈전·협착을 혈관 벽으로 밀어냄');
    else if(T<7.2)say('④ 약물방출 스텐트 (DES) 전개');
    else{dye(7.2);say('⑤ 재관류: TIMI 3 flow 회복'+(sim.src==='real'?' · 실측 ECG는 시술 전 기록 그대로입니다':''));}
  }
  if(end&&T>end){procFinish();return;}
  if(proc.reperf&&SU.uIsc.value.w>0){SU.uIsc.value.w=Math.max(0,SU.uIsc.value.w-dt*.25);}
}
$('tProc').addEventListener('click',()=>{const v=!$('procPop').classList.contains('on');$('procPop').classList.toggle('on',v);$('tProc').setAttribute('aria-expanded',v);});
$('procPop').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const p=b.dataset.p;
  if(p==='reset'){procClear();proc.reperf=false;sim.stK=1;setScenario(sim.sc);}else procStart(p);});
$('flu').addEventListener('change',e=>{proc.flu=e.target.checked;if(proc.mode&&proc.mode!=='cabg')setFlu(proc.flu);});

function extrasScenario(sc){echoCase(sc);
  {const f=sc.flags||{};SU.uDil.value=f.hf?.17:0;SU.uHcm.value=f.hcm?1:0;
   const sp=v3(LD.lvSept).sub(MVc);sp.addScaledVector(uLV,-sp.dot(uLV)).normalize();SU.uSep.value.copy(sp);
   const H=f.shunt==='vsd'||f.shunt==='tof'?vsdP:f.shunt==='asd'?iaP:null;SU.uHole.value.set(H?H.x:0,H?H.y:0,H?H.z:0,H?(f.shunt==='asd'?.2:.17):0);}
  const f=sc.flags||{};
  if(proc.mode||proc.reperf){procClear();proc.reperf=false;}sim.stK=1;setStops();
  if(shuntOn!==(f.shunt||null)){shuntOn=f.shunt||null;for(let i=0;i<NP;i++){if(paths[pPath[i]].sh||shuntOn){pPath[i]=pick(i%2);pU[i]=Math.random();}}pInit=false;}
  aneur.forEach(m=>{m.visible=!!f.kd;});
  {const h=SU.uHi2.value;h.set(0,0,0,0);if(f.afib||f.flutter)h.set(0,0,1,1);else if(f.vfib||['vt','tdp','pea','asys'].includes(sc.id))h.set(1,1,0,0);else if(f.hf||f.hcm)h.set(1,0,0,0);else if(sc.id==='pvc')h.set(0,1,0,0);}
  setTags(tagsFor(sc));
}
function extrasFrame(real,dt,t,L,R,now){lastLR=[L,R];
  if(camAnim){const k=Math.min(1,(performance.now()-camAnim.s)/700),e=ease(k);camera.position.lerpVectors(camAnim.p0,camAnim.p1,e);controls.target.lerpVectors(camAnim.q0,TARGET,e);if(k>=1){camAnim=null;controls.enableDamping=true;}}
  SU.uPulse.value=.5+.5*Math.sin(now*.006);
  {const fI=sim.sc.flags||{},pu=SU.uPulse.value;['lad','rca'].forEach(k=>{const on=!proc.reperf&&((fI.infarct==='ant'&&k==='lad')||(fI.infarct==='inf'&&k==='rca')||fI.isch===k);corMats[k].emissive.setRGB(on?.25+.75*pu:0,on&&fI.isch?.3*pu:0,on?.08*pu:0);});}
  if(axG.visible)for(const q of axL){const v=Math.min(1,Math.abs(lead[q.i])*1.4);q.mat.opacity=.28+.72*v;q.sp.material.opacity=.6+.4*v;}
  fpsE=fpsE*.95+real*.05;if(++fpsN>90){fpsN=0;const mx=PRMAX;let pr=renderer.getPixelRatio();
    if(fpsE>.024&&pr>1)pr=Math.max(1,pr-.25);else if(fpsE<.0125&&pr<mx)pr=Math.min(mx,pr+.25);
    if(pr!==renderer.getPixelRatio()){renderer.setPixelRatio(pr);sizeAll();}}
  // 박출 파면 (대동맥·폐동맥 벽을 따라 진행)
  [L,R].forEach((s,i)=>{const on=s.ej>0;if(on&&!ejPrev[i])ejT[i]=t;ejPrev[i]=on;const d=(t-ejT[i])*7.5;(i?paMat:aoMat).userData.own.uJo.value.w=d<5?d+.01:-1;});
  ringCol(rings.mv,vOpen.mv.value);ringCol(rings.tv,vOpen.tv.value);ringCol(rings.pv,vOpen.pv.value);ringCol(rings.av,aoValve.open);
  deformPt(rings.mv.userData.base,rings.mv.position);deformPt(rings.tv.userData.base,rings.tv.position);
  if(ly.val&&!(SU.uFlu.value>.5)){vMV.upd(vOpen.mv.value,t);vTV.upd(vOpen.tv.value,t);vAV.upd(aoValve.open,t);vPV.upd(vOpen.pv.value,t);}
  // Purkinje 망 발광
  let a=0,b=0;for(const o of cond){if(o.key==='purkL')a=Math.max(a,o.lit);else if(o.key==='purkR')b=Math.max(b,o.lit);}
  netL.material.color.setRGB(.24+.66*a,.3+.7*a,.08+.27*a);netR.material.color.setRGB(.24+.66*b,.3+.7*b,.08+.27*b);
  procFrame(paused?0:real);
  // 위험 표지 위치
  if(tags.length){const w=view.clientWidth,h=view.clientHeight;for(const g of tags){deformPt(g.p,tmp);const cutT=clip.distanceToPoint(tmp)<-.02;tmp.project(camera);if(!g.w)g.w=g.el.offsetWidth;g.el.style.transform='translate3d('+clamp((tmp.x+1)/2*w,6,Math.max(6,w-g.w-16)).toFixed(1)+'px,'+clamp((1-tmp.y)/2*h,56,h-64).toFixed(1)+'px,0) translate(10px,-50%)';g.el.style.display=(tmp.z<1&&!cutT)?'':'none';}}
}

const DIR0=new V3(1.2,.9,11).sub(TARGET).normalize();let camAnim=null;
function resetView(){const h=view.clientHeight,t=Math.tan(camera.fov*Math.PI/360),d=fitD(h,t);
  camAnim={p0:camera.position.clone(),q0:controls.target.clone(),p1:TARGET.clone().addScaledVector(DIR0,d),s:performance.now()};userMoved=false;controls.enableDamping=false;}
$('tReset').addEventListener('click',resetView);controls.addEventListener('start',()=>{camAnim=null;controls.enableDamping=true;});
/* ───────────── 9. 심초음파 (2D echo + M-mode) ───────────── */
const ECHO={dop:true,tab:'fn',adj:false,on:false,view:'plax',tilt:0,rot:0,mm:false,cur:0,lastCol:-1,key:''};
const RTW=448,RTH=356,MW=600,MH=256,DMAX=3.9,ANG=.68,WD=2*DMAX*Math.sin(ANG),EWIN=4;
const rtE=new THREE.WebGLRenderTarget(RTW,RTH,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
const rtM=new THREE.WebGLRenderTarget(MW,MH,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false});
const eCam=new THREE.OrthographicCamera(-1,1,1,-1,.05,30),qCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const ePlane=new THREE.Plane(),ePlane2=new THREE.Plane();
const LVap=v3(LD.LVapO),lvMid=MVc.clone().addScaledVector(uLV,.45*LLV);
let EB={P:new V3(),D:new V3(0,0,-1),N:new V3(1,0,0),L:new V3()};
const EWIN_TXT={plax:'흉골 좌연 3–4 늑간',['psax-av']:'흉골 좌연 · 90° 회전',['psax-mv']:'흉골 좌연 · 90° 회전',['psax-pm']:'흉골 좌연 · 90° 회전',a4c:'심첨부 (좌측 5 늑간)',a2c:'심첨부 · 60° 회전',sc4c:'명치 아래 (검상돌기)'};
const EVIEWS=[['plax','PLAX','흉골연 장축','흉골연 장축'],['psax-av','PSAX-AV','단축·대동맥판','흉골연 단축 · 대동맥판'],['psax-mv','PSAX-MV','단축·승모판','흉골연 단축 · 승모판'],['psax-pm','PSAX-PM','단축·유두근','흉골연 단축 · 유두근'],['a4c','A4C','심첨 4방','심첨 4방'],['a2c','A2C','심첨 2방','심첨 2방'],['sc4c','SC','늑골하 4방','늑골하 4방']];
function viewBasis(name){
  const perp=(v,a)=>v.clone().addScaledVector(a,-v.dot(a)).normalize();let P,D,N,ref,tg;
  if(name==='plax'||name.indexOf('psax')===0){
    D=perp(new V3(0,0,-1),uLV);
    if(name==='plax'){N=new V3().crossVectors(uLV,AOc.clone().sub(MVc)).normalize();D=perp(D,N);tg=MVc.clone().lerp(lvMid,.45);ref=LVap;}
    else if(name==='psax-av'){N=nAo.clone().normalize();D=perp(new V3(0,0,-1),N);tg=AOc.clone().addScaledVector(nAo.clone().normalize(),.12);ref=TVc;}
    else{N=uLV.clone();tg=name==='psax-av'?AOc.clone():name==='psax-mv'?MVc.clone().addScaledVector(uLV,.22*LLV):MVc.clone().addScaledVector(uLV,.55*LLV);ref=TVc;}
    P=tg.clone().addScaledVector(D,-2.25);
  }else if(name==='a4c'||name==='a2c'){
    D=uLV.clone().negate();N=new V3().crossVectors(uLV,TVc.clone().sub(MVc)).normalize();if(name==='a2c')N.applyAxisAngle(uLV,1.05);
    P=LVap.clone().addScaledVector(uLV,.5);ref=TVc;tg=MVc.clone();
  }else{
    tg=MVc.clone().lerp(TVc,.5).addScaledVector(uLV,.4*LLV);P=tg.clone().add(new V3(-.5,-2.7,1.2));D=tg.clone().sub(P).normalize();
    N=new V3().crossVectors(D,TVc.clone().sub(MVc)).normalize();ref=TVc;
  }
  let L=new V3().crossVectors(N,D).normalize();if(ref.clone().sub(P).dot(L)>0){N.negate();L.negate();}
  const tq=new THREE.Quaternion().setFromAxisAngle(L,ECHO.tilt);D.applyQuaternion(tq);N.applyQuaternion(tq);
  const rq=new THREE.Quaternion().setFromAxisAngle(D,ECHO.rot);N.applyQuaternion(rq);L.crossVectors(N,D).normalize();
  EB={P,D,N,L,tg};
}
function aimCursor(){const d=EB.tg.clone().sub(EB.P);ECHO.cur=clamp(Math.atan2(d.dot(EB.L),d.dot(EB.D)),-ANG+.05,ANG-.05);}
function setupEchoCam(){const {P,D,N}=EB,C=P.clone().addScaledVector(D,DMAX/2);
  eCam.left=-WD/2;eCam.right=WD/2;eCam.top=DMAX/2;eCam.bottom=-DMAX/2;eCam.updateProjectionMatrix();
  eCam.position.copy(C).addScaledVector(N,10);eCam.up.copy(D).negate();eCam.lookAt(C);eCam.updateMatrixWorld();
  ePlane.set(N.clone().negate(),N.dot(P));ePlane2.set(N.clone(),-(N.dot(P)-.1));}
// 3D probe & fan
const fanMat=new THREE.MeshBasicMaterial({color:0x57d3e6,transparent:true,opacity:.2,side:THREE.DoubleSide,depthWrite:false});
const fanEdge=new THREE.LineBasicMaterial({color:0x8fefff,transparent:true,opacity:.95,depthTest:false});
const fanArc=new THREE.LineBasicMaterial({color:0x8fefff,transparent:true,opacity:.45,depthTest:false});
const beamMat=new THREE.LineDashedMaterial({color:0xffe678,dashSize:.08,gapSize:.06,transparent:true,opacity:.9,depthTest:false});
const probeMat=new THREE.MeshStandardMaterial({color:0xe9f6ff,roughness:.25,metalness:.15,emissive:0x1d6f80,emissiveIntensity:.9});
const probeTip=new THREE.MeshStandardMaterial({color:0x57d3e6,roughness:.3,emissive:0x57d3e6,emissiveIntensity:.8});
const probe=new THREE.Group();heart.add(probe);probe.visible=false;
const pLabCv=document.createElement('canvas');pLabCv.width=512;pLabCv.height=128;const pLabTex=new THREE.CanvasTexture(pLabCv);
const pLab=new THREE.Sprite(new THREE.SpriteMaterial({map:pLabTex,transparent:true,depthTest:false}));pLab.scale.set(.9,.22,1);pLab.renderOrder=14;let pLabTxt='';
function setProbeLabel(t){const sub=EWIN_TXT[ECHO.view]||'',key=t+'|'+sub;if(key===pLabTxt)return;pLabTxt=key;const x=pLabCv.getContext('2d');x.clearRect(0,0,512,128);
  x.fillStyle='rgba(4,10,16,.88)';x.strokeStyle='#57d3e6';x.lineWidth=5;x.beginPath();x.moveTo(20,6);x.arcTo(506,6,506,122,16);x.arcTo(506,122,6,122,16);x.arcTo(6,122,6,6,16);x.arcTo(6,6,506,6,16);x.closePath();x.fill();x.stroke();
  x.textAlign='center';x.textBaseline='middle';x.fillStyle='#ffe678';x.font='600 64px "IBM Plex Mono",monospace';x.fillText(t,256,66);pLabTex.needsUpdate=true;}
function buildFan(){while(probe.children.length){const c=probe.children.pop();if(c.geometry)c.geometry.dispose();}
  const {P,D,L}=EB,pt=(a,r)=>P.clone().addScaledVector(D,Math.cos(a)*r).addScaledVector(L,Math.sin(a)*r);
  const pts=[P.clone()];for(let i=0;i<=40;i++)pts.push(pt(-ANG+2*ANG*i/40,DMAX));
  const idx=[];for(let i=1;i<=40;i++)idx.push(0,i,i+1);const g=new THREE.BufferGeometry().setFromPoints(pts);g.setIndex(idx);
  const f=new THREE.Mesh(g,fanMat);f.renderOrder=12;probe.add(f);
  const e=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),fanEdge);e.renderOrder=13;probe.add(e);
  [1.25,2.5,3.75].forEach(r=>{const ap=[];for(let i=0;i<=24;i++)ap.push(pt(-ANG+2*ANG*i/24,r));const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(ap),fanArc);l.renderOrder=13;probe.add(l);});
  const bl=new THREE.Line(new THREE.BufferGeometry().setFromPoints([P.clone(),pt(ECHO.cur,DMAX)]),beamMat);bl.computeLineDistances();bl.renderOrder=13;probe.add(bl);
  const q=new THREE.Quaternion().setFromUnitVectors(new V3(0,1,0),D.clone().negate());
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.13,.2,.75,24),probeMat);body.position.copy(P).addScaledVector(D,-.48);body.quaternion.copy(q);probe.add(body);
  const tip=new THREE.Mesh(new THREE.BoxGeometry(.42,.08,.16),probeTip);tip.position.copy(P).addScaledVector(D,-.07);
  const m=new THREE.Matrix4().makeBasis(L,D.clone().negate(),new V3().crossVectors(L,D.clone().negate()));tip.quaternion.setFromRotationMatrix(m);probe.add(tip);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.26,.02,8,40),new THREE.MeshBasicMaterial({color:0x8fefff,transparent:true,opacity:.8,depthTest:false}));ring.position.copy(P);ring.quaternion.setFromUnitVectors(new V3(0,0,1),D);ring.renderOrder=13;probe.add(ring);
  pLab.position.copy(P).addScaledVector(D,-.95);probe.add(pLab);setProbeLabel((EVIEWS.find(v=>v[0]===ECHO.view)||[0,''])[1]);}
// echo shaders
const ECHO_GLSL=`
uniform sampler2D tE;uniform vec2 uRes;uniform float uWd,uDm,uAng,uT,uCur,uMM,uGain;varying vec2 vUv;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}
float echoAt(vec2 xy){
  vec2 uv=vec2(xy.x/uWd+.5,1.-xy.y/uDm),px=1./uRes;
  float t=texture2D(tE,uv).r*.36+(texture2D(tE,uv+vec2(px.x,0.)).r+texture2D(tE,uv-vec2(px.x,0.)).r+texture2D(tE,uv+vec2(0.,px.y)).r+texture2D(tE,uv-vec2(0.,px.y)).r)*.16;
  float r=length(xy),th=atan(xy.x,xy.y);
  float e=abs(texture2D(tE,uv+vec2(0.,2.5*px.y)).r-texture2D(tE,uv-vec2(0.,2.5*px.y)).r);
  float sp=vn(vec2(r*75.,th*58.)+uT*.12)*.6+vn(vec2(r*170.,th*125.)-uT*.08)*.4;
  float blood=.02+.05*vn(vec2(r*70.,th*55.)+uT*.9);
  float v=mix(blood,.34+.8*sp*sp*1.25,t)+e*.6*sp;
  v*=mix(1.1,.55,clamp(r/uDm,0.,1.))*uGain;
  v+=.25*exp(-r/.22)*sp;
  return clamp(v,0.,1.);
}`;
const qGeo=new THREE.PlaneGeometry(2,2),QVS='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
const EU={tE:{value:rtE.texture},tM:{value:rtM.texture},uRes:{value:new THREE.Vector2(RTW,RTH)},uWd:{value:WD},uDm:{value:DMAX},uAng:{value:ANG},uT:{value:0},uCur:{value:0},uMM:{value:1},uCol:{value:0},uGain:{value:1}};
const dMat=new THREE.ShaderMaterial({uniforms:EU,vertexShader:QVS,depthTest:false,depthWrite:false,fragmentShader:ECHO_GLSL+`
void main(){vec2 xy=vec2((vUv.x-.5)*uWd,(1.-vUv.y)*uDm);float r=length(xy),th=atan(xy.x,xy.y);
  if(abs(th)>uAng||r>uDm){gl_FragColor=vec4(0.,0.,0.,1.);return;}
  float v=pow(echoAt(xy),1.1)*smoothstep(uAng,uAng-.015,abs(th))*smoothstep(uDm,uDm-.05,r);
  vec3 c=vec3(v)*vec3(1.,.985,.955);
  if(uMM>.5){float d=abs(sin(th-uCur))*r;if(d<.007*uDm&&fract(r*7.)<.55&&abs(th-uCur)<.3)c=mix(c,vec3(.45,.86,1.),.75);}
  gl_FragColor=vec4(c,1.);}`});
const cMat=new THREE.ShaderMaterial({uniforms:EU,vertexShader:QVS,depthTest:false,depthWrite:false,fragmentShader:ECHO_GLSL+`
void main(){float r=(1.-vUv.y)*uDm;vec2 xy=r*vec2(sin(uCur),cos(uCur));float v=pow(echoAt(xy),1.1);gl_FragColor=vec4(vec3(v)*vec3(1.,.985,.955),1.);}`});
const mMat=new THREE.ShaderMaterial({uniforms:EU,vertexShader:QVS,depthTest:false,depthWrite:false,fragmentShader:`uniform sampler2D tM;uniform float uCol;varying vec2 vUv;
void main(){vec3 c=texture2D(tM,vUv).rgb;float g=fract(vUv.x-uCol);if(g>0.&&g<.012)c=vec3(0.);gl_FragColor=vec4(c,1.);}`});
const dScene=new THREE.Scene(),cScene=new THREE.Scene(),mScene=new THREE.Scene();
dScene.add(new THREE.Mesh(qGeo,dMat));cScene.add(new THREE.Mesh(qGeo,cMat));mScene.add(new THREE.Mesh(qGeo,mMat));
const slabMat=new THREE.ShaderMaterial({side:THREE.DoubleSide,depthTest:false,clipping:true,
  vertexShader:`#include <common>
#include <clipping_planes_pars_vertex>
varying float vNz;
void main(){vNz=length(normal)<.01?0.:abs(normalize(normalMatrix*normal).z);
#include <begin_vertex>
#include <project_vertex>
#include <clipping_planes_vertex>
}`,fragmentShader:`#include <common>
#include <clipping_planes_pars_fragment>
varying float vNz;
void main(){
#include <clipping_planes_fragment>
float f=1.-smoothstep(.5,.93,vNz);gl_FragColor=vec4(vec3(max(f,.14)),1.);}`});
// 초음파: 판막 판엽·판륜이 단면과 만나는 선을 CPU로 정확히 계산해 밝은 에코선으로 그림
const vCutP=new Float32Array(12000*6),vCutG=new THREE.BufferGeometry();vCutG.setAttribute('position',new THREE.BufferAttribute(vCutP,3));vCutG.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(vCutP.length),3));
const vCut=new THREE.LineSegments(vCutG,new THREE.LineBasicMaterial({color:0xffffff}));vCut.frustumCulled=false;vCut.visible=false;heart.add(vCut);const avLeaf=[vCut];
function cutValves(N,d){let w=0;const O=vCutP,cap=O.length-6;
  const run=(pos,idx)=>{for(let k=0;k<idx.length&&w<cap;k+=3){const a3=idx[k]*3,b3=idx[k+1]*3,c3=idx[k+2]*3;
      const da=N.x*pos[a3]+N.y*pos[a3+1]+N.z*pos[a3+2]-d,db=N.x*pos[b3]+N.y*pos[b3+1]+N.z*pos[b3+2]-d,dc=N.x*pos[c3]+N.y*pos[c3+1]+N.z*pos[c3+2]-d;
      if((da>0&&db>0&&dc>0)||(da<0&&db<0&&dc<0))continue;let n=0;
      for(const [p,q,dp,dq] of [[a3,b3,da,db],[b3,c3,db,dc],[c3,a3,dc,da]]){if((dp>0)===(dq>0)||dp===dq)continue;const t=dp/(dp-dq);O[w++]=pos[p]+(pos[q]-pos[p])*t;O[w++]=pos[p+1]+(pos[q+1]-pos[p+1])*t;O[w++]=pos[p+2]+(pos[q+2]-pos[p+2])*t;if(++n===2)break;}
      if(n===1)w-=3;}};
  for(const V of VALVES){if(!V.g.visible)continue;for(const L of V.leaves)run(L.pos,L.ge.index.array);run(V.tubeP,V.tube.index.array);}
  vCutG.setDrawRange(0,w/3);vCutG.attributes.position.needsUpdate=true;}
const vis=new Map();
function solo(list){heart.traverse(o=>{if(o!==heart){vis.set(o,o.visible);o.visible=false;}});list.forEach(o=>{let p=o;while(p&&p!==heart){p.visible=true;p=p.parent;}});}
function unsolo(){vis.forEach((v,o)=>{o.visible=v;});vis.clear();}
let EBcur=null,EBa=null,ECam=null;
const basisQ=b=>new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(b.L,b.D.clone().negate(),b.N));
function curBasis(){const tk=ECHO.view+'|'+ECHO.tilt+'|'+ECHO.rot;
  if(tk!==ECHO.tk){viewBasis(ECHO.view);const t={P:EB.P.clone(),q:basisQ(EB),tg:EB.tg.clone()};ECHO.tgt=t;
    if(EBcur&&ECHO.animNext){EBa={p0:EBcur.P.clone(),q0:EBcur.q.clone(),s:performance.now()};camSwing(EB);}else EBcur={P:t.P.clone(),q:t.q.clone()};ECHO.tk=tk;ECHO.animNext=false;}
  if(EBa){const k=Math.min(1,(performance.now()-EBa.s)/850),e=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;EBcur={P:EBa.p0.clone().lerp(ECHO.tgt.P,e),q:EBa.q0.clone().slerp(ECHO.tgt.q,e)};if(k>=1)EBa=null;}
  const q=EBcur.q,L=new V3(1,0,0).applyQuaternion(q),D=new V3(0,-1,0).applyQuaternion(q),N=new V3(0,0,1).applyQuaternion(q);EB={P:EBcur.P.clone(),D,N,L,tg:ECHO.tgt.tg};}
function camSwing(t){let dir=t.N.clone().multiplyScalar(.85).addScaledVector(t.D,-.5).add(new V3(0,.22,0)).normalize();
  const cur=camera.position.clone().sub(controls.target);if(dir.dot(cur)<0)dir=t.N.clone().multiplyScalar(-.85).addScaledVector(t.D,-.5).add(new V3(0,.22,0)).normalize();
  ECam={d0:cur.clone().normalize(),d1:dir,r:view.clientWidth>=760?(()=>{const cr=glc.getBoundingClientRect(),pr=echoP.getBoundingClientRect(),w3=Math.max(120,pr.left-cr.left-6),asp=w3/view.clientHeight,tt=Math.tan(camera.fov*Math.PI/360);return clamp(Math.max(13,3.4/(tt*asp)),13,48);})():9.8,r0:cur.length(),t0:controls.target.clone(),s:performance.now()};controls.enableDamping=false;userMoved=true;}
function camStep(){if(!ECam)return;const k=Math.min(1,(performance.now()-ECam.s)/900),e=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
  const q=new THREE.Quaternion().setFromUnitVectors(ECam.d0,ECam.d1),qi=new THREE.Quaternion().slerp(q,e);
  controls.target.lerpVectors(ECam.t0,TARGET,e);camera.position.copy(controls.target).addScaledVector(ECam.d0.clone().applyQuaternion(qi),ECam.r0+(ECam.r-ECam.r0)*e);camera.lookAt(controls.target);
  if(k>=1){ECam=null;controls.enableDamping=true;}}
controls.addEventListener('start',()=>{ECam=null;});
function echoPass(){
  curBasis();const anim=!!EBa;const key=ECHO.view+'|'+ECHO.tilt+'|'+ECHO.rot+'|'+sim.sc.id+'|'+(proc.reperf?1:0)+'|'+Math.round(SU.uIsc.value.w*10)+'|'+ECHO.cur.toFixed(2);setupEchoCam();if(anim||key!==ECHO.key){ECHO.key=anim?'':key;buildFan();drawEchoOv();}
  const bg=scene.background;scene.background=null;const list=[wallF,wallB,papM];
  solo(list);const dw=list.map(m=>m.material.depthWrite);list.forEach(m=>{m.material.depthWrite=true;});
  SU.uEcho.value=1;renderer.clippingPlanes=[ePlane];renderer.setRenderTarget(rtE);renderer.setClearColor(0x000000,1);renderer.clear();renderer.render(scene,eCam);
  unsolo();list.forEach((m,i)=>{m.material.depthWrite=dw[i];});
  renderer.clippingPlanes=[];renderer.autoClear=false;cutValves(EB.N,EB.N.dot(EB.P)-.03);
  solo(avLeaf);scene.overrideMaterial=slabMat;
  {const px=WD/RTW*1.1,p0=eCam.position.clone();for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1],[.7,.7],[-.7,-.7],[.7,-.7],[-.7,.7]]){eCam.position.copy(p0).addScaledVector(EB.L,dx*px).addScaledVector(EB.D,dy*px);eCam.updateMatrixWorld();renderer.render(scene,eCam);}eCam.position.copy(p0);eCam.updateMatrixWorld();}
  renderer.autoClear=true;scene.overrideMaterial=null;unsolo();
  renderer.clippingPlanes=[];SU.uEcho.value=0;scene.background=bg;renderer.setRenderTarget(null);
}
function mmodePass(){const col=Math.floor(((sim.t%EWIN)/EWIN)*MW)%MW;EU.uCol.value=col/MW;
  if(ECHO.lastCol<0){ECHO.lastCol=col;return;}if(col===ECHO.lastCol)return;
  const seg=(a,b)=>{if(b<=a)return;rtM.viewport.set(a,0,b-a,MH);rtM.scissor.set(a,0,b-a,MH);rtM.scissorTest=true;renderer.setRenderTarget(rtM);renderer.autoClear=false;renderer.render(cScene,qCam);renderer.autoClear=true;};
  const a=ECHO.lastCol+1;if(col>=a)seg(a,col+1);else{seg(a,MW);seg(0,col+1);}ECHO.lastCol=col;renderer.setRenderTarget(null);}
const echoP=$('echoP'),echoS=$('echoS'),echoM=$('echoM'),eOv=$('echoOv'),eEcg=$('echoEcg');
function rectOf(el){const c=glc.getBoundingClientRect(),r=el.getBoundingClientRect();return [r.left-c.left,c.bottom-r.bottom,r.width,r.height];}
let eAcc=1;
function echoRender(real){
  const W=view.clientWidth,H=view.clientHeight,cr=glc.getBoundingClientRect(),pr=echoP.getBoundingClientRect(),wide=W>=760;
  const m=wide?[0,0,Math.max(60,pr.left-cr.left-6),H]:null;
  EU.uT.value=sim.t;EU.uCur.value=ECHO.cur;EU.uMM.value=ECHO.mm?1:0;
  camStep();eAcc+=real;if(eAcc>=1/45||paused||EBa){eAcc=0;echoPass();}
  if(ECHO.mm)mmodePass();
  renderer.setScissorTest(true);renderer.setClearColor(0x04080d,1);
  renderer.setViewport(0,0,W,H);renderer.setScissor(0,0,W,H);renderer.clear();
  if(m){renderer.setViewport(...m);renderer.setScissor(...m);camera.aspect=m[2]/m[3];camera.updateProjectionMatrix();renderer.render(scene,camera);}
  orientOverlay(m?[m[0]+6,m[1]+(H<560?10:112),m[2]-12,m[3]-(H<560?70:180)]:(ECHO.tab==='3d'?rectOf($('e3D')):null));
  let s=rectOf(echoS);renderer.setViewport(...s);renderer.setScissor(...s);renderer.render(dScene,qCam);
  if(!m&&ECHO.tab==='3d'){const q=rectOf($('e3D'));renderer.setViewport(...q);renderer.setScissor(...q);renderer.setClearColor(0x0a1420,1);renderer.clear();camera.aspect=q[2]/q[3];camera.zoom=1;camera.updateProjectionMatrix();renderer.render(scene,camera);camera.zoom=1;camera.updateProjectionMatrix();}
  if(ECHO.mm&&ECHO.tab==='mm'){s=rectOf(echoM);renderer.setViewport(...s);renderer.setScissor(...s);renderer.render(mScene,qCam);}
  renderer.setScissorTest(false);renderer.setViewport(0,0,W,H);
  lvTick(real);drawDoppler(real);
  if(ECHO.mm){const w=eEcg.clientWidth,h=eEcg.clientHeight;if(eEcg.width!==Math.round(w*dpr)){eEcg.width=Math.round(w*dpr);eEcg.height=Math.round(h*dpr);}
    const ctx=eEcg.getContext('2d');ex=ctx;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);trace(buf[1],0,h*.62,w,EWIN,h*.32,'#6ff09a',1.5);ex=ecgCtx;}
}
let wallS=null;function wallSample(){if(wallS)return wallS;const p=gWall.attributes.position,o=[];for(let k=0;k<p.count;k+=5)o.push(new V3(p.getX(k),p.getY(k),p.getZ(k)));return wallS=o;}
function lesionTargets(){const f=sim.sc.flags||{},out=[],Wp=wallSample(),{P,D,N,L}=EB,d=new V3();
  const near=(pred,label,col)=>{let sx=0,sy=0,n=0;for(const v of Wp){if(!pred(v))continue;d.copy(v).sub(P);if(Math.abs(d.dot(N))>.07)continue;sx+=d.dot(L);sy+=d.dot(D);n++;}if(n>4)out.push({x:sx/n,y:sy/n,label,col});};
  const iw=SU.uIsc.value.w;if(iw>.05){const c=new V3(SU.uIsc.value.x,SU.uIsc.value.y,SU.uIsc.value.z),ak=SU.uIscK.value>.8&&!proc.reperf;near(v=>v.distanceTo(c)<iw*.8,ak?'무운동 (akinesis)':'운동저하 (hypokinesis)',ak?'#ff5d66':'#f2b84b');}
  const sep=v3(LD.lvSept).lerp(v3(LD.rvSept),.5);
  if(f.lbb)near(v=>v.distanceTo(sep)<.5,'중격 비동시성','#b48cff');
  if(f.hcm)near(v=>v.distanceTo(sep)<.5,'중격 비후 · 과운동','#57d3e6');
  if(f.shunt==='vsd'||f.shunt==='tof')near(v=>v.distanceTo(vsdP)<.42,'VSD 결손','#ffcf70');
  if(f.shunt==='asd')near(v=>v.distanceTo(iaP)<.45,'ASD 결손','#ffcf70');
  if(f.hf)near(v=>v.distanceTo(LVap)<.7,'좌심실 확장 · 운동저하','#f2b84b');
  return out;}
function boxText(c,x,y,t,font,col,align){c.font=font;const w=c.measureText(t).width,bx=align==='r'?x-w-12:x;c.fillStyle='rgba(4,8,13,.78)';rrect(c,bx,y-14,w+12,20,5);c.fill();c.fillStyle=col;c.textAlign='left';c.textBaseline='alphabetic';c.fillText(t,bx+6,y);return w+12;}
function drawEchoOv(){const w=eOv.clientWidth,h=eOv.clientHeight;if(!w)return;eOv.width=Math.round(w*dpr);eOv.height=Math.round(h*dpr);const c=eOv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
  const sx=w/WD,sy=h/DMAX,ox=w/2,fs=w<360?10.5:12;c.strokeStyle='rgba(255,230,120,.85)';c.lineWidth=1;
  for(let cm=1;cm<=15;cm++){const r=cm*.25,x=ox-Math.sin(ANG)*r*sx-4,y=Math.cos(ANG)*r*sy;c.beginPath();c.moveTo(x,y);c.lineTo(x-(cm%5?4:9),y);c.stroke();if(cm%5===0){c.fillStyle='rgba(255,230,120,.95)';c.font='600 '+fs+'px "IBM Plex Mono",monospace';c.textAlign='right';c.textBaseline='middle';c.fillText(String(cm),x-12,y);}}
  const v=EVIEWS.find(q=>q[0]===ECHO.view);boxText(c,w-6,20,v[1]+' · '+v[2],'600 '+fs+'px "IBM Plex Sans KR",sans-serif','#ffe678','r');
  boxText(c,6,h-8,'깊이 16 cm','500 '+(fs-1)+'px "IBM Plex Sans KR",sans-serif','rgba(214,226,236,.9)');
  c.fillStyle='#ffe678';c.beginPath();const mx=ox+Math.sin(ANG)*.3*sx+14;c.moveTo(mx,8);c.lineTo(mx+8,8);c.lineTo(mx+4,15);c.closePath();c.fill();
  {const {P,D,N,L}=EB,dd=new V3();c.font='600 '+(fs-1)+'px "IBM Plex Sans KR",sans-serif';
   CHAM.forEach(ch=>{dd.copy(ch[1]).sub(P);if(Math.abs(dd.dot(N))>.45||(ECHO.view==='psax-av'&&ch[0].indexOf('Ao')===0))return;const xl=dd.dot(L),yd=dd.dot(D),th=Math.atan2(xl,yd);if(Math.abs(th)>ANG*.95||yd>DMAX*.95||yd<.3)return;
     const t=ch[0].split(' ')[0],tw=c.measureText(t).width,x=ox+xl*sx-tw/2-5,y=yd*sy+5;c.fillStyle='rgba(4,8,13,.55)';rrect(c,x,y-13,tw+10,18,4);c.fill();c.fillStyle=ch[2];c.textAlign='left';c.textBaseline='alphabetic';c.fillText(t,x+5,y);});
   c.font='500 '+(fs-1.5)+'px "IBM Plex Sans KR",sans-serif';c.strokeStyle='rgba(255,230,120,.85)';c.lineWidth=1.2;
   estr().forEach(([t,p],k)=>{dd.copy(p).sub(P);if(Math.abs(dd.dot(N))>.3)return;const xl=dd.dot(L),yd=dd.dot(D),th=Math.atan2(xl,yd);if(Math.abs(th)>ANG*.92||yd>DMAX*.92||yd<.35)return;
     const px=ox+xl*sx,py=yd*sy,side=px<ox?-1:1,tw=c.measureText(t).width,lx=clamp(px+side*34,4,w-4),ly=clamp(py+(k%2?22:-20),30,h-30),bx=side<0?Math.max(4,lx-tw-8):Math.min(w-tw-12,lx);
     c.beginPath();c.moveTo(lx,ly);c.lineTo(px,py);c.stroke();c.fillStyle='#ffe678';c.beginPath();c.arc(px,py,2.2,0,TAU);c.fill();
     c.fillStyle='rgba(4,8,13,.6)';rrect(c,bx,ly-12,tw+8,17,4);c.fill();c.fillStyle='#ffe678';c.textAlign='left';c.textBaseline='alphabetic';c.fillText(t,bx+4,ly+1);});}
  lesionTargets().forEach(o=>{const th=Math.atan2(o.x,o.y),r=Math.hypot(o.x,o.y);if(Math.abs(th)>ANG||r>DMAX)return;const tx=ox+o.x*sx,ty=o.y*sy,side=tx<ox?-1:1,bx=clamp(tx+side*42,8,w-8),by=Math.max(40,ty-26);
    c.save();c.strokeStyle=o.col;c.fillStyle=o.col;c.lineWidth=2.4;c.shadowColor='rgba(0,0,0,.8)';c.shadowBlur=4;c.beginPath();c.moveTo(bx,by);c.lineTo(tx+side*6,ty-4);c.stroke();
    const ang=Math.atan2(ty-4-by,tx+side*6-bx);c.beginPath();c.moveTo(tx+side*2,ty-1);c.lineTo(tx+side*6-Math.cos(ang-.5)*11,ty-4-Math.sin(ang-.5)*11);c.lineTo(tx+side*6-Math.cos(ang+.5)*11,ty-4-Math.sin(ang+.5)*11);c.closePath();c.fill();c.restore();
    c.font='600 '+(fs-.5)+'px "IBM Plex Sans KR",sans-serif';const tw=c.measureText(o.label).width;boxText(c,side<0?Math.max(4,bx-tw-12):Math.min(w-tw-16,bx),by-4,o.label,'600 '+(fs-.5)+'px "IBM Plex Sans KR",sans-serif',o.col);});}
function echoLayout(){const narrow=view.clientWidth<760,gap=6;document.body.classList.toggle('enarrow',narrow);
  echoP.style.bottom='';
  const pw=echoP.clientWidth;
  if(!narrow&&ECHO.tab==='3d'){ECHO.tab='fn';ECHO.mm=false;}
  $('eTab3').hidden=!narrow;[...$('eTabs').children].forEach(b=>b.setAttribute('aria-selected',b.dataset.v===ECHO.tab));
  const low={fn:$('eFunc'),mm:echoM,'3d':$('e3D')};if(!low[ECHO.tab])ECHO.tab='';Object.keys(low).forEach(k=>{low[k].style.display=k===ECHO.tab?'':'none';});
  $('eAdj').style.display=ECHO.adj?'':'none';$('eAdjB').setAttribute('aria-expanded',ECHO.adj);
  const land=innerHeight<=560&&innerWidth>innerHeight&&!narrow;
  if(land)echoP.classList.remove('ewide');
  if(land){echoS.classList.remove('btn-side','btn-below');echoS.style.marginBottom='';const ratio=WD/DMAX,hh=$('eHead').offsetHeight,room=echoP.clientHeight-hh-8;if(ECHO.tab==='3d')ECHO.tab='';
    if(ECHO.tab==='mm')echoM.style.height=Math.min(130,Math.max(90,room-$('eTabs').offsetHeight-$('eRec').offsetHeight-16))+'px';
    let sh=Math.min(room,echoP.clientWidth*.56/ratio);sh=Math.max(100,sh);echoS.style.height=sh+'px';echoS.style.width=(sh*ratio)+'px';drawEchoOv();drawBull();return;}
  {const ratio=WD/DMAX,H=echoP.clientHeight,top=$('eHead').offsetHeight+$('eRec').offsetHeight+gap*2,lowEst=ECHO.tab==='fn'?Math.max(110,$('eFunc').offsetHeight):ECHO.tab==='mm'?170:0;
   const colW=clamp(pw*.44,240,340),s0=Math.min(pw/ratio,H-top-44-lowEst-gap*3),stackSh=(pw-s0*ratio)/2>=92&&s0>=130?s0:Math.min(pw/ratio,H-top-44-lowEst-52-gap*3),wideSh=Math.min((pw-colW-10)/ratio,H-top-48-gap);
   const wide=!narrow&&ECHO.tab!=='3d'&&wideSh>stackSh*1.12;echoP.classList.toggle('ewide',wide);
   if(wide){echoS.classList.remove('btn-side');echoS.classList.add('btn-below');echoS.style.marginBottom='42px';
     const sh=Math.max(100,wideSh);echoS.style.height=sh+'px';echoS.style.width=(sh*ratio)+'px';echoP.style.gridTemplateColumns=(sh*ratio)+'px minmax(0,1fr)';
     if(ECHO.tab==='mm')echoM.style.height=clamp(H-top-$('eTabs').offsetHeight-($('eAdj').style.display==='none'?0:$('eAdj').offsetHeight+gap)-gap*2-4,110,260)+'px';
     drawEchoOv();drawBull();return;}
   echoP.style.gridTemplateColumns='';}
  const ratio=WD/DMAX,base=$('eHead').offsetHeight+$('eTabs').offsetHeight+$('eRec').offsetHeight+gap*5+($('eAdj').style.display==='none'?0:$('eAdj').offsetHeight+gap),room=echoP.clientHeight-base-2;
  const calc=BR=>{const rm=room-BR;let sh,lowH=0;
    if(ECHO.tab==='fn'){lowH=$('eFunc').offsetHeight;sh=Math.min(pw/ratio,rm-lowH);}
    else if(ECHO.tab==='mm'||ECHO.tab==='3d'){const minLow=ECHO.tab==='mm'?100:Math.min(200,rm*.42),maxLow=ECHO.tab==='mm'?(narrow?170:210):900;sh=Math.min(pw/ratio,rm*(ECHO.tab==='3d'?.56:.62));lowH=clamp(rm-sh,minLow,maxLow);sh=Math.min(pw/ratio,rm-lowH);}
    else sh=Math.min(pw/ratio,rm);return [Math.max(60,sh),lowH];};
  let [sh,lowH]=calc(0),below=(pw-sh*ratio)/2<92||sh<130;if(below)[sh,lowH]=calc(52);
  if(ECHO.tab==='mm'||ECHO.tab==='3d')(ECHO.tab==='mm'?echoM:$('e3D')).style.height=lowH+'px';
  echoS.classList.toggle('btn-side',!below);echoS.classList.toggle('btn-below',below);echoS.style.marginBottom=below?'42px':'';
  echoS.style.height=sh+'px';echoS.style.width=(sh*ratio)+'px';fitOver();drawEchoOv();drawBull();}
function fitOver(){const over=echoP.scrollHeight-echoP.clientHeight;if(over<=0||innerHeight<=560&&innerWidth>innerHeight)return;const r=WD/DMAX,h=Math.max(60,echoS.offsetHeight-over-2);echoS.style.height=h+'px';echoS.style.width=(h*r)+'px';}
function setTab(t){if(t===ECHO.tab&&echoP.clientHeight<520)t='';ECHO.tab=t;ECHO.mm=t==='mm';if(t==='mm'){ECHO.lastCol=-1;renderer.setRenderTarget(rtM);renderer.setClearColor(0,1);renderer.clear();renderer.setRenderTarget(null);}echoLayout();}
const orient=new THREE.Group();orient.visible=false;heart.add(orient);
{const CH=window.CHEST;if(CH){const g=n=>{const P=CH.parts[n],i16=new Int16Array(b64(P.p)),pos=new Float32Array(i16.length);for(let k=0;k<i16.length;k++)pos[k]=i16[k]/CH.q;
    const ge=new THREE.BufferGeometry();ge.setAttribute('position',new THREE.BufferAttribute(pos,3));ge.setIndex(new THREE.BufferAttribute(P.w===2?new Uint16Array(b64(P.i)):new Uint32Array(b64(P.i)),1));ge.computeVertexNormals();return ge;};
  const bm=new THREE.MeshStandardMaterial({color:0xe9e2d0,roughness:.6,metalness:0,transparent:true,opacity:.3,depthWrite:false,envMap:envTex,envMapIntensity:.4});
  const cm=new THREE.MeshStandardMaterial({color:0xbcd8e6,roughness:.5,transparent:true,opacity:.28,depthWrite:false});
  const b1=new THREE.Mesh(g('bone'),bm),c1=new THREE.Mesh(g('cart'),cm);b1.renderOrder=2;c1.renderOrder=2;orient.add(b1,c1);}}
let ESTR=null;function estr(){if(ESTR)return ESTR;const pp=inner[0].geometry.attributes.position,aw=inner[0].geometry.attributes.aW,e2=v3(LD.e2l);let A=new V3(),B=new V3(),na=0,nb=0;
  for(let i=0;i<pp.count;i++){if(aw.getX(i)<.5)continue;const p=new V3(pp.getX(i),pp.getY(i),pp.getZ(i));if(p.clone().sub(MVc).dot(e2)>0){A.add(p);na++;}else{B.add(p);nb++;}}
  ESTR=[['RVOT',PVc.clone().addScaledVector(nPv,-.45)],['PA 폐동맥',PVc.clone().addScaledVector(nPv,.55)],['AV 대동맥판',AOc.clone()],['MV 승모판',MVc.clone().addScaledVector(uLV,.12)],['TV 삼첨판',TVc.clone().addScaledVector(uRV,.1)]];
  if(na)ESTR.push(['유두근 (전외측)',A.divideScalar(na)]);if(nb)ESTR.push(['유두근 (후내측)',B.divideScalar(nb)]);return ESTR;}
const CHAM=[['LV 좌심실',v3(LD.LVin),'#ff8a92'],['RV 우심실',v3(LD.RVin),'#8fb4ff'],['LA 좌심방',v3(LD.LAc),'#ffb0a8'],['RA 우심방',v3(LD.RAc),'#a9c8ff'],['Ao 대동맥',AOc.clone().addScaledVector(nAo,.5),'#ff9a9a']];
CHAM.forEach(c=>{const s=textSprite(c[0].split(' ')[0],c[2],c[1],.26);s.material.depthTest=false;s.renderOrder=15;orient.add(s);});
function textSprite(t,col,pos,h){const cv=document.createElement('canvas'),x=cv.getContext('2d');x.font='600 44px "IBM Plex Sans KR",sans-serif';const w=Math.ceil(x.measureText(t).width)+36;cv.width=w;cv.height=72;
  x.fillStyle='rgba(4,10,16,.78)';x.beginPath();x.moveTo(14,2);x.arcTo(w-2,2,w-2,70,14);x.arcTo(w-2,70,2,70,14);x.arcTo(2,70,2,2,14);x.arcTo(2,2,w-2,2,14);x.closePath();x.fill();
  x.font='600 44px "IBM Plex Sans KR",sans-serif';x.fillStyle=col;x.textBaseline='middle';x.fillText(t,18,38);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),transparent:true,depthTest:false}));sp.scale.set(h*w/72,h,1);sp.position.copy(pos);sp.renderOrder=15;return sp;}
const eOri=$('eOri'),eCmp=$('eCmp');
function orientOverlay(r){if(!r){eOri.style.display='none';return;}eOri.classList.toggle('tight',r[2]<300);const cr=glc.getBoundingClientRect(),vr=view.getBoundingClientRect();eOri.style.display='block';
  eOri.style.left=(cr.left-vr.left+r[0])+'px';eOri.style.top=(cr.top-vr.top+(cr.height-r[1]-r[3]))+'px';eOri.style.width=r[2]+'px';eOri.style.height=r[3]+'px';
  const v=EVIEWS.find(q=>q[0]===ECHO.view)||['','',''];$('eWinT').textContent=v[1]+' · '+(EWIN_TXT[ECHO.view]||'');
  const s=64;if(eCmp.width!==s*dpr){eCmp.width=s*dpr;eCmp.height=s*dpr;}const c=eCmp.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,s,s);
  c.fillStyle='rgba(4,10,16,.7)';c.beginPath();c.arc(s/2,s/2,s/2-1,0,TAU);c.fill();c.strokeStyle='rgba(120,190,220,.35)';c.lineWidth=1;c.stroke();
  [[new V3(0,1,0),'머리','#ffe678'],[new V3(1,0,0),'왼쪽','#7cf5a6'],[new V3(0,0,1),'앞','#57d3e6']].map(q=>{const d=q[0].clone().transformDirection(camera.matrixWorldInverse);return[d,q[1],q[2]];})
   .sort((p,q)=>p[0].z-q[0].z).forEach(([d,t,col])=>{const L=20,x=s/2+d.x*L,y=s/2-d.y*L,al=d.z<-.3?.45:1;c.globalAlpha=al;c.strokeStyle=col;c.lineWidth=2;c.beginPath();c.moveTo(s/2,s/2);c.lineTo(x,y);c.stroke();
     c.fillStyle=col;c.beginPath();c.arc(x,y,2.5,0,TAU);c.fill();c.font='600 9.5px "IBM Plex Sans KR",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(t,s/2+d.x*(L+9),s/2-d.y*(L+9));c.globalAlpha=1;});}
function setEcho(on){if(on){call.style.display='none';sel=null;}orient.visible=on;if(!on)orientOverlay(null);ECHO.on=on;$('tEcho').textContent=on?'초음파 닫기':'심초음파';if(!on){ECam=null;EBa=null;controls.enableDamping=true;}document.body.classList.toggle('echo-on',on);$('tEcho').setAttribute('aria-pressed',on);echoP.hidden=!on;view.classList.toggle('echo',on);probe.visible=on;tagBox.style.display=on?'none':'';
  if(on){ECHO.tab=innerHeight<520?'':(view.clientWidth<760?'3d':'fn');echoReset();viewBasis(ECHO.view);camSwing(EB);ECHO.lastCol=-1;renderer.setRenderTarget(rtM);renderer.setClearColor(0,1);renderer.clear();renderer.setRenderTarget(null);requestAnimationFrame(()=>{echoLayout();});}
  else{renderer.setScissorTest(false);sizeAll();resetView();}}
$('tEcho').addEventListener('click',()=>setEcho(!ECHO.on));
$('eBack').addEventListener('click',()=>setEcho(false));
/* color Doppler: blood particles crossing the scan plane, red = toward probe, blue = away */
let dGrid=null;const eFlow=$('eFlow'),dPrev=new Float32Array(NP*3),dVel=new Float32Array(NP*3);let dInit=false;
$('eDop').addEventListener('click',()=>{ECHO.dop=!ECHO.dop;$('eDop').setAttribute('aria-pressed',ECHO.dop);});
function drawDoppler(real){const w=echoS.clientWidth,h=echoS.clientHeight;if(!w)return;
  if(eFlow.width!==Math.round(w*dpr)||eFlow.height!==Math.round(h*dpr)){eFlow.width=Math.round(w*dpr);eFlow.height=Math.round(h*dpr);}
  const c=eFlow.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
  const dt=paused?0:real*speed;
  if(dt>0){if(!dInit){dPrev.set(hPos);dInit=true;}for(let i=0;i<NP*3;i++){const v=(hPos[i]-dPrev[i])/dt;dVel[i]=Math.abs(v)<40?dVel[i]*.4+v*.6:dVel[i];dPrev[i]=hPos[i];}}
  if(!ECHO.dop||!(ly.flow&&vm!=='elec'))return;
  const {P,D,N,L}=EB,sx=w/WD,sy=h/DMAX,ox=w/2,R=Math.max(3,w*.022);
  // Doppler colour box (ROI)
  c.strokeStyle='rgba(120,220,255,.75)';c.lineWidth=1.5;c.setLineDash([]);c.beginPath();const a0=-ANG*.75,a1=ANG*.75,r0=DMAX*.18,r1=DMAX*.92;
  c.moveTo(ox+Math.sin(a0)*r0*sx,Math.cos(a0)*r0*sy);for(let k=0;k<=16;k++){const t=a0+(a1-a0)*k/16;c.lineTo(ox+Math.sin(t)*r0*sx,Math.cos(t)*r0*sy);}
  for(let k=16;k>=0;k--){const t=a0+(a1-a0)*k/16;c.lineTo(ox+Math.sin(t)*r1*sx,Math.cos(t)*r1*sy);}c.closePath();c.stroke();c.setLineDash([]);
  const GW=72,GH=Math.max(8,Math.round(GW*h/w));if(!dGrid||dGrid.w!==GW||dGrid.h!==GH){const cv=document.createElement('canvas');cv.width=GW;cv.height=GH;dGrid={w:GW,h:GH,cv,ctx:cv.getContext('2d'),sum:new Float32Array(GW*GH),n:new Float32Array(GW*GH)};}
  dGrid.sum.fill(0);dGrid.n.fill(0);
  for(let i=0;i<NP;i++){const j=i*3,px=hPos[j]-P.x,py=hPos[j+1]-P.y,pz=hPos[j+2]-P.z,dn=px*N.x+py*N.y+pz*N.z;if(Math.abs(dn)>.22)continue;
    const xl=px*L.x+py*L.y+pz*L.z,yd=px*D.x+py*D.y+pz*D.z,rr=Math.hypot(xl,yd),th=Math.atan2(xl,yd);if(th<a0||th>a1||rr<r0||rr>r1)continue;
    const vr=-(dVel[j]*px+dVel[j+1]*py+dVel[j+2]*pz)/Math.max(.01,Math.hypot(px,py,pz)),gx=Math.floor((xl/WD+.5)*GW),gy=Math.floor(yd/DMAX*GH);
    for(let oy=-1;oy<=1;oy++)for(let oxx=-1;oxx<=1;oxx++){const X=gx+oxx,Y=gy+oy;if(X<0||Y<0||X>=GW||Y>=GH)continue;const wt=oxx||oy?.45:1,k=Y*GW+X;dGrid.sum[k]+=vr*wt;dGrid.n[k]+=wt;}}
  const im=dGrid.ctx.createImageData(GW,GH),d=im.data;
  for(let k=0;k<GW*GH;k++){const n=dGrid.n[k];if(n<.6)continue;const v=dGrid.sum[k]/n,s=clamp(Math.abs(v)/2.4,0,1);if(s<.05)continue;const o=k*4;
    if(v>0){d[o]=150+105*s;d[o+1]=30+170*s*s;d[o+2]=20;}else{d[o]=20+40*s*s;d[o+1]=60+160*s*s;d[o+2]=170+85*s;}
    d[o+3]=Math.round(255*clamp(.6+.4*s,0,.95)*clamp(n/1.5,0,1));}
  dGrid.ctx.putImageData(im,0,0);c.imageSmoothingEnabled=true;c.drawImage(dGrid.cv,0,0,w,h);
  // colour scale bar
  const bx=w-14,by=h*.32,bh=h*.32,gr=c.createLinearGradient(0,by,0,by+bh);gr.addColorStop(0,'#ffc814');gr.addColorStop(.25,'#c8281a');gr.addColorStop(.5,'#000');gr.addColorStop(.75,'#2c50d0');gr.addColorStop(1,'#3cd8ff');
  c.fillStyle=gr;c.fillRect(bx,by,6,bh);c.strokeStyle='rgba(255,255,255,.4)';c.strokeRect(bx-.5,by-.5,7,bh+1);
  c.fillStyle='rgba(230,238,245,.85)';c.font='500 9.5px "IBM Plex Mono",monospace';c.textAlign='right';c.textBaseline='middle';c.fillText('+',bx-3,by+4);c.fillText('−',bx-3,by+bh-4);}
EVIEWS.forEach(([k,ab,sh,nm])=>{const b=document.createElement('button');b.type='button';b.dataset.v=k;b.innerHTML='<b></b><small></small>';b.firstChild.textContent=ab;b.lastChild.textContent=sh;b.title=nm;b.setAttribute('aria-pressed',k===ECHO.view);
  b.addEventListener('click',()=>{ECHO.animNext=true;ECHO.view=k;ECHO.tilt=0;ECHO.rot=0;$('eTilt').value=0;$('eRot').value=0;viewBasis(k);aimCursor();[...$('eView').children].forEach(x=>x.setAttribute('aria-pressed',x===b));});$('eView').appendChild(b);});
$('eTabs').addEventListener('click',e=>{const b=e.target.closest('button');if(b)setTab(b.dataset.v);});
$('eAdjB').addEventListener('click',()=>{ECHO.adj=!ECHO.adj;echoLayout();requestAnimationFrame(echoLayout);});
/* routine view per case + reset */
const ECHO_DEF={nsr:['plax','기본 선별: 심실 크기·판막·벽 두께'],stach:['plax','빈맥 원인 선별: 수축력·심낭삼출'],af:['a4c','심방 크기·판막, 수축 불규칙'],afl:['a4c','심방 크기·판막'],svt:['plax','구조적 심질환 선별'],
  vt:['psax-pm','벽운동·경색 흉터 (VT 기질)'],tdp:['plax','전반 수축 평가'],sbrady:['plax','기본 평가'],junc:['plax','기본 평가'],avb1:['plax','기본 평가'],wb:['plax','기본 평가'],m2:['plax','기본 평가'],
  chb:['a4c','심실 기능, 심방·심실 수축 해리'],lbbb:['psax-pm','중격 비동시성 (M-mode로 septal flash)'],rbbb:['a4c','우심실 크기 (폐색전증 감별)'],pvc:['plax','M-mode로 조기수축과 박출 감소'],
  isch:['psax-pm','국소 벽운동 (17분절)'],stA:['a4c','LAD 영역: 심첨·중격·전벽 벽운동'],stI:['psax-pm','RCA 영역: 하벽·하중격 벽운동'],hk:['plax','기본 평가'],
  hf:['plax','LVEF·좌심실 크기'],pedema:['a4c','LVEF·판막 역류 원인'],vf:['sc4c','심정지: 맥박 확인 10초 안에 늑골하로'],pea:['sc4c','PEA: 심장 움직임·심낭삼출·우심실 확장'],asys:['sc4c','진짜 무수축인지 확인'],
  vsd:['a4c','근성부 심실중격 결손 · 좌→우 단락 제트'],asd:['sc4c','심방중격 결손 (늑골하에서 잘 보임)'],pda:['psax-av','동맥관 (고위 단축)'],tof:['plax','대동맥 기승·VSD'],hcm:['plax','중격 두께·SAM (M-mode)'],kd:['psax-av','관상동맥 기시부·동맥류']};
function echoReset(){const d=ECHO.def||['plax'];ECHO.animNext=!!EBcur&&ECHO.on;ECHO.view=d[0];ECHO.tilt=0;ECHO.rot=0;$('eTilt').value=0;$('eRot').value=0;viewBasis(ECHO.view);aimCursor();ECHO.key='';
  [...$('eView').children].forEach(x=>x.setAttribute('aria-pressed',x.dataset.v===ECHO.view));}
function echoCase(sc){const d=ECHO_DEF[sc.id]||['plax','기본 평가'];ECHO.def=d;const v=EVIEWS.find(q=>q[0]===d[0]);$('eRec').textContent='루틴 단면 · '+v[3]+' — '+d[1];if(ECHO.on)echoReset();}
$('eReset').addEventListener('click',()=>{ECHO.animNext=true;ECHO.tilt=0;ECHO.rot=0;$('eTilt').value=0;$('eRot').value=0;viewBasis(ECHO.view);aimCursor();ECHO.key='';});
['eDop','eAdjB','eReset','eTilt','eRot'].forEach(id=>$(id).addEventListener('pointerdown',e=>e.stopPropagation()));
$('eRec').addEventListener('click',()=>{$('eRec').classList.toggle('full');echoLayout();});
$('ePause').addEventListener('click',()=>$('tPause').click());$('e3R').addEventListener('click',()=>{viewBasis(ECHO.view);camSwing(EB);});new MutationObserver(()=>$('ePause').setAttribute('aria-pressed',$('tPause').getAttribute('aria-pressed'))).observe($('tPause'),{attributes:true});
/* LV function: EF / SV / CO, live LV volume, 17-segment wall motion */
const EDV={hf:185,pedema:165,hcm:85,sbrady:135,chb:150,vsd:150,asd:130,avb1:125};
const SEG_LAD=[1,2,7,8,13,14,17],SEG_RCA=[3,4,9,10,15],SEG_LCX=[5,6,11,12,16];
function lvFunc(){const sc=sim.sc,f=sc.flags||{},t=sim.t,vs=sim.V.filter(e=>e.t<=t&&e.t>t-6);
  const mech=vs.length?vs.reduce((s,e)=>s+e.mech,0)/vs.length:0;let ef=62*mech;const iw=clamp(SU.uIsc.value.w,0,1);if(iw>0)ef*=1-SU.uIscK.value*.32*iw;
  if(f.hcm)ef=74;if(f.vfib||sc.id==='asys'||!vs.length)ef=0;if(sc.id==='pea')ef=Math.min(ef,4);
  let hr=0;if(vs.length>1)hr=60*(vs.length-1)/(vs[vs.length-1].t-vs[0].t);const edv=EDV[sc.id]||120,sv=edv*ef/100;
  return{ef,edv,sv,co:sv*hr/1000,mech:Math.max(.05,vs.length?vs[vs.length-1].mech:1)};}
function wallMotion(){const sc=sim.sc,f=sc.flags||{},s=new Array(18).fill('n');let note='정상 벽운동 (normokinesis)';const all=v=>{for(let i=1;i<=17;i++)s[i]=v;};
  if(f.vfib){all('x');note='세동 · 벽운동 평가 불가';}
  else if(sc.id==='asys'||sc.id==='pea'){all('a');note='전반적 무운동 (global akinesis)';}
  else if(f.infarct&&!proc.reperf){(f.infarct==='ant'?SEG_LAD:SEG_RCA).forEach(i=>{s[i]='a';});note=f.infarct==='ant'?'LAD 영역 무운동 (anterior akinesis)':'RCA 영역 무운동 (inferior akinesis)';}
  else if(f.infarct&&proc.reperf){(f.infarct==='ant'?SEG_LAD:SEG_RCA).forEach(i=>{s[i]='h';});note='재관류 후 기절 심근 · 운동저하';}
  else if(f.isch){SEG_LAD.forEach(i=>{s[i]='h';});note='LAD 영역 운동저하 (hypokinesis)';}
  else if(f.hf){all('h');note='전반적 운동저하 (global hypokinesis)';}
  else if(['vt','tdp'].includes(sc.id)){all('h');note='빠른 심박 · 충만 부족, 운동저하';}
  else if(f.lbb){[2,3,8,9,14].forEach(i=>{s[i]='d';});note='중격 비동시성 (septal dyssynchrony)';}
  else if(f.hcm){all('k');note='과운동 · 비대칭 중격 비후 (HCM)';}
  return{s,note};}
const WMC={n:'#4fd08a',h:'#f2b84b',a:'#ff5d66',d:'#b48cff',k:'#57d3e6',x:'#5d6b78'};
function drawBull(){const cv=$('eBull'),w=cv.clientWidth,h=cv.clientHeight;if(!w)return;cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
  const wm=wallMotion(),cx=w/2,cy=h/2,R=Math.min(w,h)/2-11,D=Math.PI/180;
  const ring=(r0,r1,n,first,c0)=>{for(let k=0;k<n;k++){const mid=(c0+k*360/n)*D,a0=mid-Math.PI/n,a1=mid+Math.PI/n;c.beginPath();c.arc(cx,cy,r1,-a1,-a0);c.arc(cx,cy,r0,-a0,-a1,true);c.closePath();c.fillStyle=WMC[wm.s[first+k]];c.globalAlpha=.85;c.fill();c.globalAlpha=1;c.strokeStyle='#06101a';c.lineWidth=1.5;c.stroke();
    const tr=(r0+r1)/2;c.fillStyle='#06101a';c.font='600 9px "IBM Plex Mono",monospace';c.textAlign='center';c.textBaseline='middle';c.fillText(String(first+k),cx+Math.cos(mid)*tr,cy-Math.sin(mid)*tr);}};
  ring(R*.72,R,6,1,90);ring(R*.45,R*.72,6,7,90);ring(R*.2,R*.45,4,13,90);
  c.beginPath();c.arc(cx,cy,R*.2,0,Math.PI*2);c.fillStyle=WMC[wm.s[17]];c.fill();c.strokeStyle='#06101a';c.stroke();c.fillStyle='#06101a';c.fillText('17',cx,cy);
  c.fillStyle='rgba(200,214,226,.8)';c.font='500 9px "IBM Plex Sans KR",sans-serif';c.textBaseline='middle';c.fillText('전벽',cx,5);c.textAlign='left';c.fillText('중격',0,cy);c.textAlign='right';c.fillText('측벽',w,cy);c.textAlign='center';c.fillText('하벽',cx,h-4);
  $('eWM').textContent=wm.note;$('eWM').style.color=wm.s.slice(1).some(x=>x==='a')?'#ff8a92':wm.s.slice(1).some(x=>x==='h'||x==='d')?'#f2c46b':wm.s.slice(1).some(x=>x==='x')?'#9fb0bf':'#7fe0a8';}
const volBuf=[];let lvT=0,lvKey='';
function lvTick(real){const F=lvFunc(),L=lastLR[0]||{c:0},v=F.edv-F.sv*clamp(L.c/F.mech,0,1);volBuf.push([sim.t,v]);while(volBuf.length&&volBuf[0][0]<sim.t-EWIN)volBuf.shift();
  lvT+=real;if(lvT>.25){lvT=0;const ef=Math.round(F.ef);$('eEF').textContent=ef;$('eEF').style.color=ef>=50?'#7fe0a8':ef>=40?'#f2c46b':'#ff8a92';$('eSV').textContent=Math.round(F.sv);$('eCO').textContent=F.co.toFixed(1);$('eEDV').textContent=Math.round(F.edv);
    const k=sim.sc.id+'|'+(proc.reperf?1:0);if(k!==lvKey){lvKey=k;drawBull();}if(ECHO.on&&echoP.scrollHeight>echoP.clientHeight){fitOver();drawEchoOv();}}
  const cv=$('eVol'),w=cv.clientWidth,h=cv.clientHeight;if(!w)return;if(cv.width!==Math.round(w*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);}
  const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);const vmax=Math.max(F.edv,130)*1.05;
  c.strokeStyle='rgba(120,190,220,.18)';c.lineWidth=1;c.beginPath();c.moveTo(0,h-.5);c.lineTo(w,h-.5);c.stroke();
  c.beginPath();volBuf.forEach((p,i)=>{const x=(p[0]-(sim.t-EWIN))/EWIN*w,y=h-2-p[1]/vmax*(h-4);i?c.lineTo(x,y):c.moveTo(x,y);});c.strokeStyle='#57d3e6';c.lineWidth=1.6;c.stroke();}
$('eTilt').addEventListener('input',e=>{ECHO.tilt=+e.target.value*Math.PI/180;});$('eRot').addEventListener('input',e=>{ECHO.rot=+e.target.value*Math.PI/180;});
echoS.addEventListener('pointerdown',e=>{const r=echoS.getBoundingClientRect(),x=((e.clientX-r.left)/r.width-.5)*WD,y=(e.clientY-r.top)/r.height*DMAX;ECHO.cur=clamp(Math.atan2(x,y),-ANG+.03,ANG-.03);});
new ResizeObserver(()=>{if(ECHO.on)echoLayout();}).observe(echoP);

sizeAll();setOpacity();setCut();applyTheme();
setScenario(SC.find(s=>'#'+s.id===location.hash)||SC[0]);
window.addEventListener('hashchange',()=>{const s=SC.find(x=>'#'+x.id===location.hash);if(s&&s!==sim.sc)setScenario(s);});
requestAnimationFrame(frame);
window.__sim=sim;window.__ui={setScenario,SC,camera,controls,SU};
})();
