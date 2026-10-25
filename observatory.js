import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = id => document.getElementById(id);
const isCoarse = matchMedia('(pointer: coarse)').matches;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = $('space');
const statusText = $('status-text');
let renderer, scene, camera, controls, root, disk, diskMaterial, photonRing, halo, stars, jetTop, jetBottom, comet, cometTrail, probe;
let paused = reduceMotion, autoOrbit = false, elapsed = 0, last = 0, pulseAt = -10, probeAt = -10;
const params = {spin:.8,rs:1,bending:1.35,brightness:1.6,turbulence:1.5,env:0};
const defaults = {...params};
const clamp = (v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const infoData = {
  horizon:{title:'EVENT HORIZON · ขอบฟ้าเหตุการณ์',desc:'ขอบเขตของกาลอวกาศที่ภายในนั้นไม่มีสัญญาณหรือแสงใดสามารถเดินทางกลับออกไปยังผู้สังเกตที่อยู่ไกลได้ รูปร่างทรงกลมในฉากนี้เป็นภาพประกอบ ไม่ใช่ภาพถ่ายจริง'},
  photon:{title:'PHOTON RING · วงแหวนโฟตอน',desc:'แสงบางเส้นทางอาจโค้งอย่างรุนแรงและวนรอบหลุมดำได้ วงแหวนในภาพเป็นองค์ประกอบเชิงภาพเพื่อแสดงแนวคิด ไม่ใช่การคำนวณเส้นทางแสงแบบสัมพัทธภาพทั่วไปเต็มรูปแบบ'},
  disk:{title:'ACCRETION DISK · จานสะสมมวล',desc:'ก๊าซและพลาสมาที่สูญเสียพลังงานจากการเสียดทานและกระบวนการแม่เหล็กไหลวนรอบหลุมดำ จึงร้อนและปล่อยรังสีออกมา สีในฉากนี้เป็นการจำลองเชิงศิลป์'},
  jets:{title:'RELATIVISTIC JETS · ลำอนุภาคสัมพัทธภาพ',desc:'หลุมดำบางระบบมีลำพลาสมาพลังงานสูงพุ่งออกใกล้แนวแกนหมุน โดยเกี่ยวข้องกับสนามแม่เหล็กและสภาพแวดล้อมรอบหลุมดำ ไม่ใช่ทุกหลุมดำที่จะมีเจ็ตที่สังเกตเห็นได้'}
};
function iscoRadius(a){
  const z1=1+Math.cbrt(1-a*a)*(Math.cbrt(1+a)+Math.cbrt(1-a));
  const z2=Math.sqrt(3*a*a+z1*z1);
  return 3+z2-Math.sqrt(Math.max(0,(3-z1)*(3+z1+2*z2)));
}
function makeDiskMaterial(){
  return new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    uniforms:{uTime:{value:0},uBrightness:{value:1.6},uTurbulence:{value:1.5},uEnv:{value:0},uSpin:{value:.8}},
    vertexShader:[
      'varying vec3 vPos;',
      'void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}'
    ].join('\n'),
    fragmentShader:[
      'varying vec3 vPos;',
      'uniform float uTime;uniform float uBrightness;uniform float uTurbulence;uniform float uEnv;uniform float uSpin;',
      'void main(){',
      ' float r=length(vPos.xy);float a=atan(vPos.y,vPos.x);',
      ' float wave=sin(a*22.0-uTime*(.5+uTurbulence*.65)+r*6.0+sin(a*7.0+uTime*.6)*.8);',
      ' float filament=pow(max(0.0,.5+.5*wave),5.0);',
      ' float swirl=sin(a*39.0+r*13.0-uTime*uTurbulence*1.3)*.5+.5;',
      ' float inner=smoothstep(1.18,1.52,r);float outer=1.0-smoothstep(3.35,4.7,r);',
      ' float alpha=inner*outer*(.24+.32*filament+.16*swirl)*uBrightness*.48;',
      ' vec3 violet=vec3(.36,.08,.9);vec3 pink=vec3(1.0,.22,.56);vec3 gold=vec3(1.0,.62,.25);vec3 cyan=vec3(.0,.93,.82);',
      ' vec3 col=mix(violet,pink,clamp(.25+.35*wave+.25*uSpin,0.0,1.0));',
      ' col=mix(col,gold,smoothstep(2.0,4.7,r)*.7);',
      ' if(uEnv>.5&&uEnv<1.5) col=mix(col,gold,.75);',
      ' if(uEnv>1.5) col=mix(col,cyan,.92);',
      ' col*=.75+filament*.9+swirl*.2;',
      ' gl_FragColor=vec4(col,alpha);',
      '}'
    ].join('\n')
  });
}
function createStars(){
  const count=isCoarse?750:1500, pos=[],colors=[],sizes=[];
  for(let i=0;i<count;i++){
    const radius=18+Math.random()*30,theta=Math.random()*Math.PI*2,phi=Math.acos(2*Math.random()-1);
    pos.push(radius*Math.sin(phi)*Math.cos(theta),radius*Math.cos(phi),radius*Math.sin(phi)*Math.sin(theta));
    const t=Math.random();colors.push(t>.84?1:.52,t>.84?.78:.64,t>.84?.58:1);sizes.push(.5+Math.random()*1.5);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.setAttribute('size',new THREE.Float32BufferAttribute(sizes,1));
  return new THREE.Points(geo,new THREE.PointsMaterial({size:isCoarse ? .055 : .065,vertexColors:true,transparent:true,opacity:.72,depthWrite:false,sizeAttenuation:true}));
}
function makeTrail(){
  const pts=[];
  for(let i=0;i<=180;i++){const a=i/180*Math.PI*2;pts.push(new THREE.Vector3(Math.cos(a)*4.2,.025,Math.sin(a)*4.2));}
  const geo=new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.LineLoop(geo,new THREE.LineBasicMaterial({color:0xffb48f,transparent:true,opacity:.24}));
}
function init(){
  renderer=new THREE.WebGLRenderer({canvas,antialias:!isCoarse,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,isCoarse?1.2:1.6));
  renderer.setSize(innerWidth,innerHeight,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x020106);
  camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.1,250);
  camera.position.set(0,2.35,12.3);
  controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.055;controls.enablePan=false;controls.minDistance=4.2;controls.maxDistance=29;controls.target.set(0,0,0);controls.autoRotate=false;controls.autoRotateSpeed=.45;controls.update();
  root=new THREE.Group();scene.add(root);
  stars=createStars();scene.add(stars);
  diskMaterial=makeDiskMaterial();
  disk=new THREE.Mesh(new THREE.RingGeometry(1.2,4.65,240,8),diskMaterial);disk.rotation.x=1.1;disk.rotation.z=-.22;root.add(disk);
  const hole=new THREE.Mesh(new THREE.SphereGeometry(1.1,72,56),new THREE.MeshBasicMaterial({color:0x010107}));root.add(hole);
  const coreGlow=new THREE.Mesh(new THREE.SphereGeometry(1.16,48,32),new THREE.MeshBasicMaterial({color:0x180f28,transparent:true,opacity:.42,blending:THREE.AdditiveBlending,depthWrite:false}));root.add(coreGlow);
  photonRing=new THREE.Mesh(new THREE.TorusGeometry(1.22,.035,12,180),new THREE.MeshBasicMaterial({color:0xffbf9c,transparent:true,opacity:.84,blending:THREE.AdditiveBlending,depthWrite:false}));photonRing.rotation.x=1.1;photonRing.rotation.z=-.22;root.add(photonRing);
  halo=new THREE.Mesh(new THREE.TorusGeometry(4.9,.018,8,220),new THREE.MeshBasicMaterial({color:0x8b72ff,transparent:true,opacity:.34,blending:THREE.AdditiveBlending,depthWrite:false}));halo.rotation.x=1.1;halo.rotation.z=-.22;root.add(halo);
  const jetMat=new THREE.MeshBasicMaterial({color:0x7deeff,transparent:true,opacity:.3,blending:THREE.AdditiveBlending,depthWrite:false});
  jetTop=new THREE.Mesh(new THREE.CylinderGeometry(.025,.42,4.4,24,1,true),jetMat);jetTop.position.y=3.2;root.add(jetTop);
  jetBottom=new THREE.Mesh(new THREE.CylinderGeometry(.42,.025,4.4,24,1,true),jetMat.clone());jetBottom.position.y=-3.2;root.add(jetBottom);
  cometTrail=makeTrail();root.add(cometTrail);
  comet=new THREE.Mesh(new THREE.SphereGeometry(.09,18,14),new THREE.MeshBasicMaterial({color:0xffb48f,transparent:true,opacity:1,blending:THREE.AdditiveBlending}));root.add(comet);
  window.addEventListener('resize',onResize,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){last=0;if(!paused)requestAnimationFrame(animate);}});
  syncParams();animate(performance.now());
}
function onResize(){
  if(!renderer)return;
  camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth<700?48:40;camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight,false);
}
function syncParams(){
  params.spin=Number($('spin').value);params.rs=Number($('rs').value);params.bending=Number($('bending').value);
  params.brightness=Number($('disk-brightness').value);params.turbulence=Number($('turbulence').value);params.env=Number($('env-mode').value);
  $('spin-value').textContent=params.spin.toFixed(2);$('rs-value').textContent=params.rs.toFixed(2)+'×';$('bending-value').textContent=params.bending.toFixed(2)+'×';
  $('disk-brightness-value').textContent=params.brightness.toFixed(2)+'×';$('turbulence-value').textContent=params.turbulence.toFixed(2)+'×';
  $('metric-spin').textContent=params.spin.toFixed(2);$('metric-isco').textContent=iscoRadius(params.spin).toFixed(2);
  const horizon=1+Math.sqrt(Math.max(0,1-params.spin*params.spin));
  const dist=Math.max(camera.position.length(),horizon+.05);
  $('metric-dilation').textContent=(1/Math.sqrt(Math.max(.05,1-horizon/dist))).toFixed(2)+'×';
  diskMaterial.uniforms.uBrightness.value=params.brightness;
  diskMaterial.uniforms.uTurbulence.value=params.turbulence;
  diskMaterial.uniforms.uEnv.value=params.env;
  diskMaterial.uniforms.uSpin.value=params.spin;
  const mass=params.rs;
  root.scale.setScalar(mass);
  photonRing.scale.setScalar(1+params.bending*.035);
  photonRing.material.opacity=.35+params.bending*.19;
  halo.material.opacity=.06+params.bending*.16;
  stars.material.opacity=params.env===2?.16:.65;
  if(params.env===2)scene.background=new THREE.Color(0x010b14);
  else if(params.env===1)scene.background=new THREE.Color(0x100702);
  else scene.background=new THREE.Color(0x020106);
  disk.visible=$('show-disk').checked;
  stars.visible=$('show-stars').checked;
  jetTop.visible=jetBottom.visible=$('show-jets').checked;
  comet.visible=cometTrail.visible=$('show-tde').checked;
  $('telemetry-note').textContent='ISCO: '+iscoRadius(params.spin).toFixed(2)+' r_g · Visual mass scale: '+mass.toFixed(2)+'×';
}
function setStatus(text){statusText.textContent=text;}
function animate(now){
  if(document.hidden)return;
  requestAnimationFrame(animate);
  const dt=last?Math.min((now-last)/1000,.05):.016;last=now;
  if(!paused)elapsed+=dt;
  if(!paused){
    diskMaterial.uniforms.uTime.value=elapsed;
    root.rotation.y+=dt*(.025+params.spin*.075);
    root.rotation.x=.012*Math.sin(elapsed*.22);
    stars.rotation.y+=dt*.0015;
    jetTop.material.opacity=.22+.07*Math.sin(elapsed*1.2);
    jetBottom.material.opacity=.20+.06*Math.sin(elapsed*1.05+1.2);
    const a=elapsed*(.55+params.spin*.5);
    comet.position.set(Math.cos(a)*4.2,.12*Math.sin(a*1.8),Math.sin(a)*4.2);
    if(pulseAt>=0){
      const age=elapsed-pulseAt;
      const s=1+Math.max(0,Math.sin(age*7))*Math.max(0,1-age/1.5)*.62;
      photonRing.scale.setScalar((1+params.bending*.035)*s);
      if(age>1.5)pulseAt=-10;
    }
    if(probe&&probeAt>=0){
      const age=elapsed-probeAt,ang=age*2.0,r=3.7-age*.25;
      probe.position.set(Math.cos(ang)*r,Math.sin(age*3)*.35,Math.sin(ang)*r);
      probe.material.opacity=Math.max(0,1-age/12);
      if(age>12){root.remove(probe);probe.geometry.dispose();probe.material.dispose();probe=null;probeAt=-10;setStatus('PROBE TELEMETRY SAVED');}
    }
  }
  controls.autoRotate=autoOrbit&&!paused;
  controls.update();
  if(halo)halo.rotation.z=-.22+elapsed*.006;
  renderer.render(scene,camera);
}
const presets={
  default:{spin:.8,rs:1,bending:1.35,brightness:1.6,turbulence:1.5,env:0},
  stellar:{spin:.1,rs:.8,bending:1,brightness:2.2,turbulence:2,env:1},
  supermassive:{spin:.95,rs:1.3,bending:1.8,brightness:1.2,turbulence:.8,env:0},
  bright:{spin:.5,rs:1,bending:1.5,brightness:3.5,turbulence:2.5,env:1},
  cyber:{spin:.9,rs:1.1,bending:1.4,brightness:2,turbulence:1.8,env:2}
};
['spin','rs','bending','disk-brightness','turbulence','env-mode','show-disk','show-stars','show-jets','show-tde'].forEach(id=>{
  const el=$(id);el.addEventListener('input',syncParams);el.addEventListener('change',syncParams);
});
$('preset-universe').addEventListener('change',e=>{
  const p=presets[e.target.value];if(!p)return;
  $('spin').value=p.spin;$('rs').value=p.rs;$('bending').value=p.bending;$('disk-brightness').value=p.brightness;$('turbulence').value=p.turbulence;$('env-mode').value=p.env;syncParams();
});
$('run-probe').addEventListener('click',()=>{
  if(probe){root.remove(probe);probe.geometry.dispose();probe.material.dispose();}
  probe=new THREE.Mesh(new THREE.SphereGeometry(.105,18,14),new THREE.MeshBasicMaterial({color:0x88e8cb,transparent:true,opacity:1,blending:THREE.AdditiveBlending}));
  root.add(probe);probeAt=elapsed;setStatus('PROBE DEPLOYED · TRACKING');
});
$('export-json').addEventListener('click',()=>{
  const config={name:'VELOX Quantum Singularity Preset',spin:params.spin,massScale:params.rs,lensingIntensity:params.bending,diskLuminosity:params.brightness,plasmaTurbulence:params.turbulence,environment:params.env,components:{disk:$('show-disk').checked,stars:$('show-stars').checked,jets:$('show-jets').checked,tidalComet:$('show-tde').checked,labels:$('toggle-labels').checked},note:'Stylized visualization parameters; not measured astronomical data.'};
  const blob=new Blob([JSON.stringify(config,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='velox-singularity-mission-config.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('quantum-pulse').addEventListener('click',()=>{pulseAt=elapsed;setStatus('QUANTUM PULSE INITIATED');});
$('reset-params').addEventListener('click',()=>{
  $('spin').value=defaults.spin;$('rs').value=defaults.rs;$('bending').value=defaults.bending;$('disk-brightness').value=defaults.brightness;$('turbulence').value=defaults.turbulence;$('env-mode').value=defaults.env;$('preset-universe').value='default';
  ['show-disk','show-stars','show-jets','show-tde','toggle-labels'].forEach(id=>$(id).checked=true);$('labels-overlay').style.display='block';syncParams();setStatus('PARAMETERS RESET');
});
$('capture').addEventListener('click',()=>{
  renderer.render(scene,camera);
  try{const a=document.createElement('a');a.download='velox-quantum-singularity.png';a.href=renderer.domElement.toDataURL('image/png');a.click();setStatus('PNG SNAPSHOT SAVED');}
  catch(e){setStatus('SNAPSHOT UNAVAILABLE');console.error(e);}
});
$('toggle-labels').addEventListener('change',()=>{$('labels-overlay').style.display=$('toggle-labels').checked?'block':'none';});
$('info-close').addEventListener('click',()=>$('info-modal').classList.remove('active'));
document.querySelectorAll('.sci-label').forEach(label=>label.addEventListener('click',()=>{
  const data=infoData[label.dataset.target];if(!data)return;
  $('info-title-text').textContent=data.title;$('info-desc-text').textContent=data.desc;$('info-modal').classList.add('active');
}));
$('pause').addEventListener('click',()=>{
  paused=!paused;$('pause').textContent=paused?'RESUME':'PAUSE';$('pause').classList.toggle('active',paused);
  setStatus(paused?'SIMULATION PAUSED':'OBSERVATORY ONLINE');
  if(paused){controls.autoRotate=false;}
});
$('orbit').addEventListener('click',()=>{
  autoOrbit=!autoOrbit;$('orbit').textContent='AUTO ORBIT: '+(autoOrbit?'ON':'OFF');$('orbit').classList.toggle('active',autoOrbit);
});
function hidePanel(hide){
  const panel=$('panel');
  if(hide){panel.classList.add('closed');panel.classList.remove('open');}
  else{panel.classList.remove('closed');panel.classList.add('open');}
}
$('hide-panel').addEventListener('click',()=>hidePanel(true));
$('toggle-panel').addEventListener('click',()=>hidePanel(!$('panel').classList.contains('closed')));
$('reset-camera').addEventListener('click',()=>{
  camera.position.set(0,2.35,12.3);controls.target.set(0,0,0);controls.update();setStatus('VIEW RESET');
});
window.addEventListener('keydown',e=>{
  if(e.key==='Escape')$('info-modal').classList.remove('active');
  if(e.key.toLowerCase()==='p'&&!e.repeat)$('pause').click();
});
try{init();}catch(error){
  console.error('Observatory initialization failed:',error);
  setStatus('3D UNAVAILABLE · CHECK WEBGL');
  $('telemetry-note').textContent='3D rendering could not start in this browser. Try a current browser with WebGL enabled.';
  const warning=document.createElement('div');warning.style.cssText='position:fixed;left:50%;top:50%;z-index:20;transform:translate(-50%,-50%);max-width:420px;padding:18px;background:#100d20;border:1px solid #806a9d;color:#f5f2ff;font:12px/1.7 system-ui';warning.textContent='3D rendering could not start. Please check WebGL support or try a current Chrome / Edge browser.';document.body.appendChild(warning);
}
