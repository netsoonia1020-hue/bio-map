(function(){
'use strict';
const VER='Ver.hepato 1';
const $=id=>document.getElementById(id),V3=THREE.Vector3,H=window.HEPATO,LD=H.land,PTS=LD.pt,CS=window.HCASES;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x)),ss=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);},TAU=Math.PI*2;
const v3=a=>new V3(a[0],a[1],a[2]);
const ON_PAGES=/github\.io$/.test(location.hostname);
$('toCardio').href=ON_PAGES?'../cardio/':'https://claude.ai/artifact/QCE8KApB9MBnRmZUmL8qpR';
$('brand').textContent='응급실 간·담낭 3D 시뮬레이터 · '+VER;

/* ── renderer / scene ── */
const view=$('view'),glc=$('gl');
const renderer=new THREE.WebGLRenderer({canvas:glc,antialias:true,powerPreference:'high-performance'});
const PRMAX=Math.min(devicePixelRatio||1,3);renderer.setPixelRatio(PRMAX);
const scene=new THREE.Scene();
{const c=document.createElement('canvas');c.width=16;c.height=256;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,0,256);g.addColorStop(0,'#0b1826');g.addColorStop(.55,'#070e18');g.addColorStop(1,'#04070c');x.fillStyle=g;x.fillRect(0,0,16,256);scene.background=new THREE.CanvasTexture(c);}
const camera=new THREE.PerspectiveCamera(30,1,.1,80);
const TARGET=new V3(.25,-.35,.2),DIR0=new V3(.05,.12,1).normalize();camera.position.copy(TARGET).addScaledVector(DIR0,14);
const controls=new THREE.OrbitControls(camera,glc);controls.target.copy(TARGET);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=3;controls.maxDistance=26;controls.update();
let userMoved=false;controls.addEventListener('start',()=>{userMoved=true;camAnim=null;controls.enableDamping=true;});
scene.add(new THREE.HemisphereLight(0xcfe4ff,0x1a1014,.55));
const key=new THREE.DirectionalLight(0xfff1e6,.72);key.position.set(-2.5,3.5,6);scene.add(key);
const rim=new THREE.DirectionalLight(0x58c8ff,.5);rim.position.set(3,1.5,-5);scene.add(rim);
let envTex=null;
try{const es=new THREE.Scene();es.add(new THREE.Mesh(new THREE.SphereGeometry(20,24,16),new THREE.MeshBasicMaterial({color:0x101a26,side:THREE.BackSide})));
  const pan=(c,x,y,z,w,h)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);es.add(m);};
  pan(0xffffff,-6,9,7,9,5);pan(0x9fdcff,10,2,-6,5,9);pan(0xffd9c2,2,-9,6,8,4);
  const pm=new THREE.PMREMGenerator(renderer);envTex=pm.fromScene(es,.03).texture;pm.dispose();}catch(e){}

function b64(s){const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u.buffer;}
function geo(n){const P=H.parts[n],i16=new Int16Array(b64(P.p)),pos=new Float32Array(i16.length);for(let i=0;i<i16.length;i++)pos[i]=i16[i]/H.q;
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setIndex(new THREE.BufferAttribute(P.w===2?new Uint16Array(b64(P.i)):new Uint32Array(b64(P.i)),1));g.computeVertexNormals();return g;}
const picks=[];
function std(color,o){o=o||{};return new THREE.MeshStandardMaterial({color,roughness:o.r==null?.5:o.r,metalness:.02,envMap:envTex,envMapIntensity:o.e==null?.5:o.e,transparent:!!o.t,opacity:o.op==null?1:o.op,depthWrite:!o.t,side:o.ds?THREE.DoubleSide:THREE.FrontSide});}
function mesh(g,m,k,ord){const x=new THREE.Mesh(g,m);x.userData.k=k;x.renderOrder=ord||2;scene.add(x);picks.push(x);return x;}

/* liver: translucent shell with cirrhosis nodules, jaundice tint, necrosis mottling */
const LU={uNod:{value:0},uJau:{value:0},uNec:{value:0},uOp:{value:.38},uT:{value:0},uHi:{value:0}};
const liverMat=std(0x8e3b32,{r:.45,e:.6,t:true,ds:true});
liverMat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,LU);
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uNod;varying vec3 vLp;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvLp=position;float nb=sin(position.x*11.)*sin(position.y*11.+1.3)*sin(position.z*11.+2.1)+.5*sin(position.x*23.+.7)*sin(position.z*21.);transformed+=normal*uNod*.045*nb;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uNod,uJau,uNec,uOp,uT,uHi;varying vec3 vLp;')
   .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   {float nb=sin(vLp.x*11.)*sin(vLp.y*11.+1.3)*sin(vLp.z*11.+2.1);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.62,.46,.3)*(.82+.25*nb),uNod*.85);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.78,.64,.22),uJau*.5);
    float mt=smoothstep(.2,.7,sin(vLp.x*6.3)*sin(vLp.y*5.1+1.)*sin(vLp.z*7.7+2.)+.3);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.28,.18,.1),uNec*mt*.7);
    float fres=pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),2.2);
    diffuseColor.a=uOp>.985?1.:mix(uOp,1.,fres*.8);
    totalEmissiveRadiance+=diffuseColor.rgb*fres*.12+vec3(.2,.75,.95)*uHi*(.12+.5*fres);}`);};
liverMat.customProgramCacheKey=()=>'liver';
const liver=mesh(geo('liver'),liverMat,'liver',6);
const COL={gb:0x4f9a52,duo:0xd9a38a,panc:0xe3c27a,pduct:0xf0e0a0,cha:0xe0483c,celiac:0xe0483c,smv:0x7a63e8,splv:0x7a63e8,stomach:0xcf8f86,spleen:0x8a3550,ivc:0x3c60c8};
const M={};
Object.keys(COL).forEach(n=>{const t=n==='gb'||n==='stomach'||n==='spleen';M[n]=mesh(geo(n),std(COL[n],{r:n==='gb'?.3:.5,e:n==='gb'?.9:.5,t,op:n==='gb'?.62:(t?.42:1)}),n,t?4:2);});
M.gb.material.emissive=new THREE.Color(0);M.panc.material.emissive=new THREE.Color(0);
const gbC=v3(PTS.gc);{const g=M.gb.geometry;g.translate(-gbC.x,-gbC.y,-gbC.z);M.gb.position.copy(gbC);}
const ctxM=[M.stomach,M.spleen];
const spC=new V3();M.spleen.geometry.computeBoundingBox();M.spleen.geometry.boundingBox.getCenter(spC);M.spleen.geometry.translate(-spC.x,-spC.y,-spC.z);M.spleen.position.copy(spC);

/* schematic ducts & vessels (BodyParts3D has no mesh for these) */
const TUBE={pv:[.085,0x9a7cff,'pv'],pvR:[.06,0x9a7cff,'pv'],pvL:[.055,0x9a7cff,'pv'],ha:[.032,0xff5a5a,'ha'],haR:[.024,0xff5a5a,'ha'],haL:[.022,0xff5a5a,'ha'],
  bdR:[.03,0x6fbf4a,'bd'],bdL:[.028,0x6fbf4a,'bd'],chd:[.04,0x6fbf4a,'bd'],cys:[.026,0x6fbf4a,'bd'],cbd:[.045,0x6fbf4a,'bd'],hvR:[.055,0x4d7bf0,'hv'],hvM:[.045,0x4d7bf0,'hv'],hvL:[.05,0x4d7bf0,'hv']};
const curves={},tubes={};
Object.keys(TUBE).forEach(k=>{curves[k]=new THREE.CatmullRomCurve3(LD[k].map(v3));});
function buildTube(k,f){if(tubes[k]){scene.remove(tubes[k]);tubes[k].geometry.dispose();picks.splice(picks.indexOf(tubes[k]),1);}
  const t=TUBE[k],m=new THREE.Mesh(new THREE.TubeGeometry(curves[k],48,t[0]*(f||1),12,false),std(t[1],{r:.28,e:1}));m.userData.k=k;m.userData.grp=t[2];m.renderOrder=3;scene.add(m);picks.push(m);tubes[k]=m;
  m.material.emissive=new THREE.Color(0);return m;}
Object.keys(TUBE).forEach(k=>buildTube(k,1));
// pancreatic duct curve from the mesh (tail → head → ampulla)
const pdPts=(()=>{const p=M.pduct.geometry.attributes.position,n=p.count,bins={};for(let i=0;i<n;i++){const x=p.getX(i),b=Math.floor((x+1)*4);(bins[b]=bins[b]||[]).push([x,p.getY(i),p.getZ(i)]);}
  return Object.keys(bins).map(Number).sort((a,b)=>b-a).map(b=>{const a=bins[b];return a.reduce((s,q)=>[s[0]+q[0]/a.length,s[1]+q[1]/a.length,s[2]+q[2]/a.length],[0,0,0]);});})();
curves.pd=new THREE.CatmullRomCurve3(pdPts.map(v3).concat([v3(PTS.amp)]));
// ascites, abscess, tumour, varices, stones
const asc=new THREE.Mesh(new THREE.SphereGeometry(1,40,28),new THREE.MeshStandardMaterial({color:0x6fb6ff,transparent:true,opacity:.1,roughness:.2,depthWrite:false,envMap:envTex}));
asc.scale.set(2.3,.55,1.25);asc.position.set(.2,-2.35,.25);asc.renderOrder=8;asc.visible=false;scene.add(asc);asc.userData.k='ascites';picks.push(asc);
const absP=v3(PTS.Rl).add(new V3(.25,-.15,.35)),abs=new THREE.Group();abs.position.copy(absP);scene.add(abs);
{const core=new THREE.Mesh(new THREE.SphereGeometry(.34,32,22),std(0xd9c25a,{r:.7,e:.2}));const rimM=new THREE.Mesh(new THREE.SphereGeometry(.4,32,22),new THREE.MeshStandardMaterial({color:0xff5040,transparent:true,opacity:.35,emissive:0x601008,depthWrite:false}));
  core.userData.k='abscess';rimM.userData.k='abscess';core.renderOrder=7;rimM.renderOrder=7;abs.add(core,rimM);picks.push(core);abs.userData.rim=rimM;}
const hccP=(()=>{const p=liver.geometry.attributes.position;let best=-9,bi=0;for(let i=0;i<p.count;i++){if(p.getX(i)<-.9&&p.getY(i)<.2){const z=p.getZ(i);if(z>best){best=z;bi=i;}}}return new V3(p.getX(bi),p.getY(bi),p.getZ(bi)-.08);})();
const hcc=new THREE.Mesh(new THREE.SphereGeometry(.33,32,22),std(0xc9a46e,{r:.6,e:.3}));hcc.position.copy(hccP);hcc.userData.k='hcc';hcc.renderOrder=7;scene.add(hcc);picks.push(hcc);
const card=v3(PTS.card),varix=new THREE.Group();scene.add(varix);
for(let j=0;j<4;j++){const pts=[];for(let i=0;i<=12;i++){const t=i/12,a=j*1.6;pts.push(new V3(card.x+.12*Math.cos(a)+.05*Math.sin(t*14+j),card.y+t*1.25,card.z+.12*Math.sin(a)+.05*Math.cos(t*13+j)));}
  const m=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),60,.045,8,false),std(0x5864e8,{r:.25,e:1}));m.userData.k='varix';varix.add(m);picks.push(m);}
const esoph=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,1.4,20,1,true),std(0xd99a8a,{t:true,op:.25,ds:true}));esoph.position.copy(card).add(new V3(0,.7,0));esoph.renderOrder=5;varix.add(esoph);
const stoneG=new THREE.DodecahedronGeometry(.07,1),stoneM=std(0xd8b25a,{r:.85,e:.2});stoneM.emissive=new THREE.Color(0x3a2a08);
const stones=[];function stone(p,s){const m=new THREE.Mesh(stoneG,stoneM);m.position.copy(p);m.scale.setScalar(s||1);m.userData.k='stone';m.renderOrder=9;scene.add(m);picks.push(m);stones.push(m);return m;}
const neck=v3(PTS.neck),fund=v3(PTS.fund),amp=v3(PTS.amp),hil=v3(PTS.hil),Jp=v3(LD.cys[2]);
const cbdStone=curves.cbd.getPointAt(.72);
const NAME={liver:['간 (Liver)','담즙 생성, 해독·대사, 단백질·응고인자 합성'],gb:['담낭 (Gallbladder)','담즙을 저장·농축, 식후 CCK로 수축'],duo:['십이지장 (Duodenum)','담즙·췌액이 Vater 팽대부로 나오는 곳'],panc:['췌장 (Pancreas)','소화효소·insulin 분비'],pduct:['주췌관 (Main pancreatic duct)','췌액을 팽대부로'],
  cha:['총간동맥 (Common hepatic a.)','복강동맥 → 고유간동맥'],celiac:['복강동맥 (Celiac trunk)','간·위·비장 동맥의 뿌리'],smv:['상장간막정맥 (SMV)','소장·대장 혈액 → 간문맥'],splv:['비정맥 (Splenic v.)','비장 혈액 → 간문맥'],stomach:['위 (Stomach)','주변 장기'],spleen:['비장 (Spleen)','문맥고혈압 시 비대'],ivc:['하대정맥 (IVC)','간정맥이 합류해 우심방으로'],
  pv:['간문맥 (Portal vein) · 도식','장·비장 혈액을 간으로, 간 혈류의 약 75%'],pvR:['우간문맥','도식'],pvL:['좌간문맥','도식'],ha:['고유간동맥 (Proper hepatic a.) · 도식','간 혈류의 약 25%, 담관의 주 혈액 공급'],haR:['우간동맥','도식'],haL:['좌간동맥','도식'],
  bdR:['우간관 (Right hepatic duct) · 도식','간내 담관 → 총간관'],bdL:['좌간관 (Left hepatic duct) · 도식','간내 담관 → 총간관'],chd:['총간관 (Common hepatic duct) · 도식','담낭관과 만나 총담관'],cys:['담낭관 (Cystic duct) · 도식','Heister 나선판막'],cbd:['총담관 (Common bile duct) · 도식','췌두부 뒤를 지나 Vater 팽대부로'],
  hvR:['우간정맥','도식 · 하대정맥으로'],hvM:['중간정맥','도식'],hvL:['좌간정맥','도식'],stone:['담석 (Gallstone)','콜레스테롤·색소 결석'],abscess:['간농양 (Liver abscess)','고름 주머니, 테두리 염증'],hcc:['간세포암 (HCC)','간동맥에서 주로 혈류를 받음'],varix:['식도정맥류 (Esophageal varix)','문맥고혈압의 측부 순환'],ascites:['복수 (Ascites)','문맥고혈압·저알부민혈증']};

/* ── flow particles ── */
const seg=(k,rev)=>{const a=LD[k].map(v3);return rev?a.reverse():a;};
const join=(...ps)=>{const o=[];ps.forEach(p=>p.forEach(q=>{if(!o.length||o[o.length-1].distanceTo(q)>.02)o.push(q);}));return o;};
const duoIn=amp.clone().add(new V3(.25,-.1,.05));
const smvB=(()=>{const p=M.smv.geometry.attributes.position;let b=0;for(let i=1;i<p.count;i++)if(p.getY(i)<p.getY(b))b=i;return new V3(p.getX(b),p.getY(b),p.getZ(b));})();
const splE=(()=>{const p=M.splv.geometry.attributes.position;let b=0;for(let i=1;i<p.count;i++)if(p.getX(i)>p.getX(b))b=i;return new V3(p.getX(b),p.getY(b),p.getZ(b));})();
const ivB=(()=>{const p=M.ivc.geometry.attributes.position;let b=0;for(let i=1;i<p.count;i++)if(p.getY(i)<p.getY(b))b=i;return new V3(p.getX(b)*.5,p.getY(b)+.2,p.getZ(b)*.5);})();
const celC=(()=>{M.celiac.geometry.computeBoundingBox();const c=new V3();M.celiac.geometry.boundingBox.getCenter(c);return c;})();
const R=(name,pts,col,grp,n,sp,r)=>({name,curve:new THREE.CatmullRomCurve3(pts),col:new THREE.Color(col),grp,n,sp,r:r||.03,stop:1,len:0});
const ROUTES=[
 R('bileR',join(seg('bdR'),seg('chd'),seg('cbd'),[duoIn]),0xa6e36a,'bile',36,.55),
 R('bileL',join(seg('bdL'),seg('chd'),seg('cbd'),[duoIn]),0xa6e36a,'bile',30,.55),
 R('fillR',join(seg('bdR'),seg('chd'),seg('cys',true),[gbC]),0xa6e36a,'bile',24,.45),
 R('gbOut',join([gbC],seg('cys'),seg('cbd').slice(1),[duoIn]),0xa6e36a,'bile',30,.75),
 R('pan',curves.pd.getPoints(20).concat([duoIn]),0xffe08a,'bile',20,.5,.02),
 R('pvR',join([smvB],seg('pv'),seg('pvR')),0x9a7cff,'pv',34,.6,.05),
 R('pvL',join([splE],seg('pv'),seg('pvL')),0x9a7cff,'pv',28,.6,.05),
 R('ha',join([celC],seg('ha'),seg('haR')),0xff6b6b,'ha',22,.9,.02),
 R('haL',join([celC],seg('ha'),seg('haL')),0xff6b6b,'ha',16,.9,.02),
 R('hvR',join(seg('hvR'),[v3(PTS.ivo).add(new V3(0,.9,0))]),0x5b8cff,'hv',22,.6,.04),
 R('hvM',join(seg('hvM'),[v3(PTS.ivo).add(new V3(0,.9,0))]),0x5b8cff,'hv',14,.6,.04),
 R('hvL',join(seg('hvL'),[v3(PTS.ivo).add(new V3(0,.9,0))]),0x5b8cff,'hv',18,.6,.04),
 R('ivc',[ivB,v3(PTS.ivlo),v3(PTS.ivo),v3(PTS.ivo).add(new V3(0,.9,0))],0x5b8cff,'hv',22,.5,.08),
 R('shunt',[v3(PTS.conf),v3(PTS.conf).lerp(card,.5).add(new V3(.2,0,-.2)),card,card.clone().add(new V3(0,1.25,0))],0x9a7cff,'pv',0,.5,.05)
];
ROUTES.forEach(r=>{r.len=r.curve.getLength();});
const RT={};ROUTES.forEach((r,i)=>{RT[r.name]=r;r.i=i;});
const NP=ROUTES.reduce((s,r)=>s+r.n,0)+40,pr=new Uint8Array(NP),pu=new Float32Array(NP),pj=new Float32Array(NP*3),pPos=new Float32Array(NP*3),pCol=new Float32Array(NP*3),pv=new Float32Array(NP);
{let i=0;ROUTES.forEach((r,ri)=>{for(let k=0;k<r.n;k++,i++){pr[i]=ri;pu[i]=Math.random();}});for(;i<NP;i++){pr[i]=RT.shunt.i;pu[i]=Math.random();}
  for(let k=0;k<NP;k++){const a=Math.random()*TAU,b=Math.acos(2*Math.random()-1),rr=Math.cbrt(Math.random());pj[k*3]=Math.sin(b)*Math.cos(a)*rr;pj[k*3+1]=Math.sin(b)*Math.sin(a)*rr;pj[k*3+2]=Math.cos(b)*rr;pv[k]=.8+.4*Math.random();}}
const pGeo=new THREE.BufferGeometry();pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));pGeo.setAttribute('color',new THREE.BufferAttribute(pCol,3));
const spr=document.createElement('canvas');spr.width=spr.height=64;{const x=spr.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.3,'rgba(255,255,255,.75)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);}
const points=new THREE.Points(pGeo,new THREE.PointsMaterial({size:.085,map:new THREE.CanvasTexture(spr),vertexColors:true,transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,sizeAttenuation:true}));
points.renderOrder=10;points.frustumCulled=false;scene.add(points);
// bleeding / hemoperitoneum particles
const NB=160,bPos=new Float32Array(NB*3),bVel=new Float32Array(NB*3),bAge=new Float32Array(NB);
const bGeo=new THREE.BufferGeometry();bGeo.setAttribute('position',new THREE.BufferAttribute(bPos,3));
const bleedPts=new THREE.Points(bGeo,new THREE.PointsMaterial({size:.07,map:points.material.map,color:0xff3040,transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending}));bleedPts.renderOrder=11;bleedPts.frustumCulled=false;scene.add(bleedPts);
for(let i=0;i<NB;i++)bAge[i]=Math.random()*3;

/* ── state ── */
let sc=null,F={},meal=0,mealOn=false,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,vm='all',t=0;
const ly={bile:true,pv:true,ha:true,hv:true,ctx:true};
function stopAt(route,p){if(!p){route.stop=1;return;}let best=1,bd=1e9;for(let i=0;i<=200;i++){const q=route.curve.getPointAt(i/200),d=q.distanceTo(p);if(d<bd){bd=d;best=i/200;}}route.stop=best;}
function setCase(c){
  sc=c;F=c.flags||{};
  stones.forEach(s=>{scene.remove(s);picks.splice(picks.indexOf(s),1);});stones.length=0;
  (F.stones||[]).forEach(s=>{
    if(s==='gb'){for(let i=0;i<5;i++)stone(fund.clone().lerp(gbC,.18+.08*i).add(new V3((i%2?.06:-.06),.03*i,(i%3-1)*.05)),.9+.25*(i%2));}
    if(s==='neck')stone(neck.clone().lerp(gbC,.08),1.15);
    if(s==='neckT'){const m=stone(neck.clone(),1.1);m.userData.trans=1;}
    if(s==='cbd')stone(cbdStone,1.2);
    if(s==='amp')stone(amp.clone().lerp(v3(LD.cbd[2]),.15),1.05);});
  const dil=F.dil?2:1;['bdR','bdL','chd'].forEach(k=>buildTube(k,dil));buildTube('cbd',F.dil?1.8:1);
  stopAt(RT.bileR,F.block==='cbd'?cbdStone:F.block==='amp'?amp:null);stopAt(RT.bileL,F.block==='cbd'?cbdStone:F.block==='amp'?amp:null);
  stopAt(RT.gbOut,F.stones&&F.stones.includes('neck')?neck:(F.block==='cbd'?cbdStone:F.block==='amp'?amp:null));
  stopAt(RT.fillR,F.stones&&F.stones.includes('neck')?neck:null);stopAt(RT.pan,F.block==='amp'?amp:null);
  RT.shunt.n=F.cirr?40:0;
  LU.uNod.value=F.cirr?1:0;LU.uJau.value=F.jaund||0;LU.uNec.value=F.alf?1:0;
  liver.scale.setScalar(F.cirr?.9:F.alf?.88:1);M.spleen.scale.setScalar(F.spleen?1.4:1);
  asc.visible=!!F.ascites;abs.visible=!!F.abscess;hcc.visible=!!F.hcc;varix.visible=!!(F.varix||F.shunt);
  const pus=!!F.pus;ROUTES.forEach(r=>{if(r.grp==='bile'&&r.name!=='pan')r.col.setHex(pus?0xd6b84a:0xa6e36a);});
  for(let i=0;i<NB;i++){bAge[i]=Math.random()*3;}
  applyLayers();renderPane();setTags();renderDock();
  $('pickName').textContent=c.name;$('pickDot').style.setProperty('--sev',SEV[c.sev]);
  $('stName').textContent=c.name;$('stPill').textContent=c.status;$('stPill').style.setProperty('--sev',SEV[c.sev]);
  CS.forEach(x=>x.btn.setAttribute('aria-pressed',x===c));
  if(location.hash!=='#'+c.id){try{history.replaceState(null,'','#'+c.id);}catch(e){}}
}
function applyLayers(){
  Object.values(tubes).forEach(m=>{const g=m.userData.grp;m.visible=(g==='bd'&&ly.bile&&vm!=='blood')||(g==='pv'&&ly.pv&&vm!=='bile')||(g==='ha'&&ly.ha&&vm!=='bile')||(g==='hv'&&ly.hv&&vm!=='bile');});
  ctxM.forEach(m=>{m.visible=ly.ctx;});if(F.spleen)M.spleen.visible=true;
}

/* ── frame ── */
const tmp=new V3(),tmp2=new V3();let last=performance.now(),camAnim=null,hudT=0;
function frame(now){
  requestAnimationFrame(frame);
  const real=Math.min(.05,(now-last)/1000);last=now;const dt=paused?0:real;t+=dt;LU.uT.value=t;
  meal+=((mealOn?1:0)-meal)*Math.min(1,dt*1.2);
  const pulse=.5+.5*Math.sin(t*4);
  // gallbladder: fill / contract / distend
  const colicPush=F.stones&&F.stones.includes('neckT')?ss(.2,.6,(t%9)/9)*(1-ss(.75,.95,(t%9)/9)):0;
  const gbS=F.gb==='inflam'?1.14+.015*Math.sin(t*2):1-.28*meal-.12*colicPush;M.gb.scale.setScalar(gbS);
  M.gb.material.emissive.setRGB(F.gb==='inflam'?.45*pulse+.15:0,F.gb==='inflam'?.05:0,0);
  M.panc.material.emissive.setRGB(F.panc?.4*pulse+.15:0,F.panc?.06:0,0);M.panc.scale.setScalar(F.panc?1.06:1);
  ['bdR','bdL','chd','cbd'].forEach(k=>{tubes[k].material.emissive.setRGB(F.pus?.35*pulse:0,F.pus?.15*pulse:0,0);});
  if(abs.visible)abs.userData.rim.material.opacity=.25+.2*pulse;
  stones.forEach(s=>{if(s.userData.trans){s.position.copy(gbC).lerp(neck,.35+.65*colicPush);}});
  // particles
  const fasting=meal<.35;
  for(let i=0;i<NP;i++){
    const r=ROUTES[pr[i]];let u=pu[i];
    let act=r.n>0;
    if(r.name==='bileR'||r.name==='bileL')act=act&&(!fasting||!!F.block||F.stones&&F.stones.includes('neck'));
    if(r.name==='fillR')act=act&&fasting&&!F.block;
    if(r.name==='gbOut')act=act&&!fasting;
    if(r.name==='shunt')act=!!(F.cirr||F.shunt);
    const show=act&&((r.grp==='bile'&&ly.bile&&vm!=='blood')||(r.grp==='pv'&&ly.pv&&vm!=='bile')||(r.grp==='ha'&&ly.ha&&vm!=='bile')||(r.grp==='hv'&&ly.hv&&vm!=='bile'));
    if(!show){pPos[i*3+1]=1e4;continue;}
    let sp=r.sp*pv[i]/r.len*(r.grp==='pv'&&F.portalSlow?.35:1)*(r.grp==='bile'&&!fasting?1.5:1);
    u+=dt*sp;
    if(u>r.stop){u=r.stop-.012*Math.random()-.004*(i%5);}
    if(u>=.999||!(u>=0))u=0;
    pu[i]=u;r.curve.getPointAt(clamp(u,0,.999),tmp);
    const rr=r.r*(r.stop<1&&u>r.stop-.15?1.8:1);
    pPos[i*3]=tmp.x+pj[i*3]*rr;pPos[i*3+1]=tmp.y+pj[i*3+1]*rr;pPos[i*3+2]=tmp.z+pj[i*3+2]*rr;
    pCol[i*3]=r.col.r;pCol[i*3+1]=r.col.g;pCol[i*3+2]=r.col.b;
  }
  pGeo.attributes.position.needsUpdate=true;pGeo.attributes.color.needsUpdate=true;
  // bleeding
  const bOn=(F.bleed&&varix.visible)||(F.hemo&&hcc.visible);bleedPts.visible=bOn;
  if(bOn&&dt>0){const src=F.bleed?card.clone().add(new V3(.12,.35,.15)):hccP;
    for(let i=0;i<NB;i++){bAge[i]+=dt;if(bAge[i]>2.4){bAge[i]=0;bPos[i*3]=src.x;bPos[i*3+1]=src.y;bPos[i*3+2]=src.z;const a=Math.random()*TAU;bVel[i*3]=Math.cos(a)*.5;bVel[i*3+1]=F.bleed?.2+Math.random()*.5:-.1;bVel[i*3+2]=Math.sin(a)*.5+.3;}
      bVel[i*3+1]-=dt*1.2;bPos[i*3]+=bVel[i*3]*dt;bPos[i*3+1]+=bVel[i*3+1]*dt;bPos[i*3+2]+=bVel[i*3+2]*dt;}
    bGeo.attributes.position.needsUpdate=true;}
  // camera reset
  if(camAnim){const k=Math.min(1,(performance.now()-camAnim.s)/700),e=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;camera.position.lerpVectors(camAnim.p0,camAnim.p1,e);controls.target.lerpVectors(camAnim.q0,TARGET,e);if(k>=1){camAnim=null;controls.enableDamping=true;}}
  // tags / callout follow
  const w=view.clientWidth,h=view.clientHeight;
  for(const g of tags){tmp.copy(g.p).project(camera);if(!g.w)g.w=g.el.offsetWidth;g.el.style.transform='translate3d('+clamp((tmp.x+1)/2*w,6,Math.max(6,w-g.w-16)).toFixed(1)+'px,'+clamp((1-tmp.y)/2*h,56,h-70).toFixed(1)+'px,0) translate(10px,-50%)';g.el.style.display=tmp.z<1?'':'none';}
  if(sel){tmp.copy(sel).project(camera);call.style.transform='translate3d('+clamp((tmp.x+1)/2*w,8,w-200).toFixed(1)+'px,'+clamp((1-tmp.y)/2*h,60,h-70).toFixed(1)+'px,0) translate(16px,-50%)';}
  hudT+=real;if(hudT>.2){hudT=0;$('phaseName').textContent=F.block==='cbd'?'총담관 폐색 · 담즙 정체':F.block==='amp'?'팽대부 폐색 · 담즙·췌액 정체':F.cirr?'문맥고혈압 · 측부 순환':(meal>.5?'식사 후 · 담낭 수축 (CCK)':'공복 · 담낭 저장');}
  controls.update();renderer.render(scene,camera);
}

/* ── UI ── */
const SEV={ok:'var(--ok)',warn:'var(--warn)',crit:'var(--crit)'};
const pop=$('pop');let lastG='',gridEl=null;
CS.forEach(c=>{if(c.g!==lastG){const h=document.createElement('h3');h.textContent=c.g;pop.appendChild(h);gridEl=document.createElement('div');gridEl.className='grid';pop.appendChild(gridEl);lastG=c.g;}
  const b=document.createElement('button');b.type='button';b.className='sc';b.style.setProperty('--sev',SEV[c.sev]);b.innerHTML='<i class="dot"></i><span></span>';b.lastChild.textContent=c.name;
  b.addEventListener('click',()=>{setCase(c);togglePop(false);});gridEl.appendChild(b);c.btn=b;});
function togglePop(v){pop.classList.toggle('on',v);$('pick').setAttribute('aria-expanded',v);}
$('pick').addEventListener('click',()=>togglePop(!pop.classList.contains('on')));
$('prev').addEventListener('click',()=>setCase(CS[(CS.indexOf(sc)+CS.length-1)%CS.length]));
$('next').addEventListener('click',()=>setCase(CS[(CS.indexOf(sc)+1)%CS.length]));
let tab='st';$('tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;tab=b.dataset.v;[...$('tabs').children].forEach(x=>x.setAttribute('aria-selected',x===b));renderPane();});
const LB=window.HLABS,li=a=>a.map(x=>'<li>'+x+'</li>').join('');
const flag=(i,v)=>{const r=LB[i],lo=v<r[2],hi=v>r[3],x=(hi&&v>r[3]*3)||(lo&&v<r[2]*.75)||(i===7&&v>1.8);return (lo?'lo':hi?'hi':'')+(x&&(lo||hi)?' xx':'');};
const fmt=(i,v)=>i===7||i===4||i===5||i===6||i===10||i===11||i===13?v.toFixed(1):String(Math.round(v));
function renderPane(){const c=sc,v=c.vit;let h='';
  if(tab==='st')h='<section><h3>환자 상태 · Patient status</h3><dl><dt>의식 (Mental status)</dt><dd>'+c.loc+'</dd><dt>혈압 (BP)</dt><dd>'+v.bp[0]+'/'+v.bp[1]+' mmHg</dd><dt>맥박 (HR)</dt><dd>'+v.hr+' /분</dd><dt>체온 (Temp)</dt><dd>'+v.temp.toFixed(1)+' °C</dd><dt>호흡 (RR)</dt><dd>'+v.rr+' /분</dd><dt>증상 (Sx)</dt><dd>'+c.sx+'</dd></dl></section><section><h3>병태생리 · Pathophysiology</h3><p>'+c.patho+'</p></section><p class="note">교육용 가상 증례입니다. 담도·간문맥·간정맥은 해부 메시가 없어 도식으로 그렸습니다.<br>3D 해부 모델: BodyParts3D © DBCLS (CC BY-SA 2.1 JP)</p>';
  else if(tab==='lab')h='<section><h3>간·담도·췌장 검사 · LFT / pancreas</h3><div class="lab">'+LB.map((r,i)=>'<div class="'+flag(i,c.lab[i])+'"><span class="n">'+r[0]+'</span><span class="v">'+fmt(i,c.lab[i])+'</span><span class="r">'+r[2]+'–'+r[3]+' '+r[1]+'</span></div>').join('')+'</div></section><p class="note">가상 증례의 예시 수치입니다. 참고 범위는 검사실마다 다릅니다.</p>';
  else if(tab==='img')h='<section><h3>영상 소견 · Imaging</h3><ul>'+li(c.img)+'</ul></section>';
  else if(tab==='er')h='<section><h3>응급실 대응 · ED management</h3><ul>'+li(c.er)+'</ul></section><p class="note">약물·용량은 요약입니다. 기관 프로토콜과 최신 가이드라인을 우선하세요.</p>';
  else h='<section><h3>주의 · Caveats</h3><ul><li>교육용 시뮬레이션입니다. 실제 진료 판단에 쓰지 마세요.</li><li>간·담낭·췌장·십이지장·위·비장·혈관 일부는 BodyParts3D 실제 해부 메시이고, 담관·간문맥·간정맥·고유간동맥은 메시가 없어 해부 기준점을 이어 그린 도식입니다. 굵기와 경로는 실제와 다를 수 있습니다.</li><li>담석, 농양, 종양, 정맥류, 복수의 크기와 위치는 설명용 배치입니다.</li><li>검사 수치와 환자 상태는 가상 증례입니다.</li><li>해설 화면(2D)은 개념 이해용으로 단순화했습니다.</li></ul></section><section><h3>라이선스 · License</h3><p class="note">BodyParts3D © DBCLS, CC BY-SA 2.1 JP (파생물도 동일 조건)</p></section>';
  $('pane').innerHTML=h;}
const KEYL=[4,1,2,7,8,12];
function renderDock(){const v=sc.vit;$('vHR').textContent=v.hr;$('vBP').textContent=v.bp[0]+'/'+v.bp[1];$('vTP').textContent=v.temp.toFixed(1);$('vSP').textContent=v.spo2;$('vRR').textContent=v.rr;
  $('chips').innerHTML=KEYL.map(i=>'<span class="chip '+flag(i,sc.lab[i])+'">'+LB[i][0]+' <b>'+fmt(i,sc.lab[i])+'</b></span>').join('');}
// tags
const tagBox=$('tags');let tags=[];
const tagPt=k=>k==='cbd'?cbdStone.clone():k==='abs'?absP.clone():k==='hccP'?hccP.clone():v3(PTS[k]);
function setTags(){tagBox.innerHTML='';const list=sc.tags||(sc.id==='normal'?[['fund','담낭 · 담즙 저장'],['hil','간문부 · 이중 혈류']]:[]);
  tags=list.map(([k,txt,cls])=>{const el=document.createElement('div');el.className='tag'+(cls?' '+cls:'');el.innerHTML='<b></b><small>눌러서 해설 보기</small>';el.firstChild.textContent=txt;
    el.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();window.HEX.open(sc,'m');});tagBox.appendChild(el);return{el,p:tagPt(k)};});}
// pick → name
const call=$('call'),ray=new THREE.Raycaster(),nd=new THREE.Vector2();let sel=null,down=null;
glc.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY,performance.now()];togglePop(false);});
glc.addEventListener('pointerup',e=>{if(!down)return;const d=Math.hypot(e.clientX-down[0],e.clientY-down[1]);down=null;if(d>6)return;
  const r=glc.getBoundingClientRect();nd.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(nd,camera);
  const vis=picks.filter(m=>{let o=m;while(o){if(!o.visible)return false;o=o.parent;}return true;});let hs=ray.intersectObjects(vis,false);
  LU.uHi.value=0;if(!hs.length){sel=null;call.style.display='none';return;}
  let hh=hs[0];if(hh.object===liver&&LU.uOp.value<.6){const inn=hs.find(x=>x.object!==liver&&x.object.userData.k!=='ascites');if(inn)hh=inn;}
  const k=hh.object.userData.k,n=NAME[k]||[k,''];if(k==='liver')LU.uHi.value=1;sel=hh.point.clone();call.firstChild.textContent=n[0];call.lastChild.textContent=n[1];call.style.display='block';});
// tools
function setOp(){const v=+$('op').value;$('opO').textContent=v+'%';const o=Math.max(.04,1-v/100);LU.uOp.value=o;liverMat.depthWrite=o>.985;}
$('op').addEventListener('input',setOp);
$('vmode').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;vm=b.dataset.v;[...$('vmode').children].forEach(x=>x.setAttribute('aria-pressed',x===b));applyLayers();});
$('tMeal').addEventListener('click',()=>{mealOn=!mealOn;$('tMeal').setAttribute('aria-pressed',mealOn);});
$('tPause').addEventListener('click',()=>{paused=!paused;$('tPause').setAttribute('aria-pressed',paused);});
$('tPause').setAttribute('aria-pressed',paused);
$('tLayers').addEventListener('click',()=>{const v=!$('layers').classList.contains('on');$('layers').classList.toggle('on',v);$('tLayers').setAttribute('aria-expanded',v);});
[['lyBile','bile'],['lyPv','pv'],['lyHa','ha'],['lyHv','hv'],['lyCtx','ctx']].forEach(([id,k])=>$(id).addEventListener('change',e=>{ly[k]=e.target.checked;applyLayers();}));
function fitDist(){const h=view.clientHeight,tt=Math.tan(camera.fov*Math.PI/360);return Math.max((h<420?4:3.7)/tt,3.9/(tt*camera.aspect));}
$('tReset').addEventListener('click',()=>{camAnim={p0:camera.position.clone(),q0:controls.target.clone(),p1:TARGET.clone().addScaledVector(DIR0,fitDist()),s:performance.now()};userMoved=false;controls.enableDamping=false;});
function size(){const w=view.clientWidth,h=view.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  if(!userMoved)camera.position.copy(TARGET).addScaledVector(DIR0,fitDist());}
new ResizeObserver(size).observe(view);
window.HEPATO_API={get sc(){return sc;},get meal(){return meal;}};
size();setOp();setCase(CS.find(c=>'#'+c.id===location.hash)||CS[0]);
window.addEventListener('hashchange',()=>{const c=CS.find(x=>'#'+x.id===location.hash);if(c&&c!==sc)setCase(c);});
requestAnimationFrame(frame);
})();
