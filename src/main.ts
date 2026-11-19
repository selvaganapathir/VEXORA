import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './style.css';

type Bot = { root: THREE.Group; hp: number; alive: boolean; respawn: number; phase: number; state: 'wander'|'approach'|'retreat'|'guard'; target: THREE.Vector3; mood: number; speed: number; color: number; role:string; route:THREE.Vector3[]; waypoint:number; work:number; };
type Avatar = { root: THREE.Group; leftArm: THREE.Group; rightArm: THREE.Group; leftLeg: THREE.Group; rightLeg: THREE.Group; };
type RemotePlayer = { id:string; name:string; x:number; y:number; z:number; yaw:number; color:number };
type ServerMessage = { type:string; id?:string; players?:RemotePlayer[]; player?:RemotePlayer };
const $ = <T extends HTMLElement>(id:string) => document.getElementById(id) as T;
const canvas=$<HTMLCanvasElement>('game-canvas'), startScreen=$('start-screen'), gameUI=$('game-ui');
const nameInput=$<HTMLInputElement>('player-name'), healthFill=$('health-fill'), healthText=$('health-text'), killsText=$('kills'), playersText=$('players'), toast=$('toast'), netStatus=$('net-status');
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x9bc9e9); scene.fog=new THREE.Fog(0x9bc9e9,100,330);
const camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.1,520);
const renderer=new THREE.WebGLRenderer({canvas,antialias:!(/Mobi|Android/i.test(navigator.userAgent)),powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); renderer.setSize(innerWidth,innerHeight); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.08;
const hemi=new THREE.HemisphereLight(0xd9efff,0x52604f,2.0); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffe7c4,2.4); sun.position.set(-25,42,18); scene.add(sun);
const mat=(c:number,r=.88,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
function proceduralTexture(base:string,detail:string,repeat=16){const c=document.createElement('canvas');c.width=256;c.height=256;const x=c.getContext('2d')!;x.fillStyle=base;x.fillRect(0,0,256,256);for(let i=0;i<900;i++){x.globalAlpha=Math.random()*.16;x.fillStyle=i%2?detail:'#ffffff';const px=Math.random()*256,py=Math.random()*256;x.fillRect(px,py,Math.random()*5+1,Math.random()*3+1);}x.globalAlpha=1;const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.colorSpace=THREE.SRGBColorSpace;return t;}
const groundMat=new THREE.MeshStandardMaterial({map:proceduralTexture('#547568','#a6b5a0',36),roughness:1});
const floor=new THREE.Mesh(new THREE.PlaneGeometry(420,420),groundMat); floor.rotation.x=-Math.PI/2; floor.position.y=-.08; floor.receiveShadow=true; scene.add(floor);
const grid=new THREE.GridHelper(400,100,0x91afa0,0x718e80); grid.position.y=-.065; scene.add(grid);
const world=new THREE.Group(); scene.add(world);
function box(parent:THREE.Object3D,w:number,h:number,d:number,c:number,x:number,y:number,z:number){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));m.position.set(x,y,z);parent.add(m);return m;}
function buildWorld(){
  // Expanded district: central plaza, roads, residential blocks, shops and park.
  const roadMat=new THREE.MeshStandardMaterial({map:proceduralTexture('#343e48','#9aa0a5',5),roughness:.95});
  const road=new THREE.Mesh(new THREE.PlaneGeometry(420,12),roadMat);road.rotation.x=-Math.PI/2;road.position.set(0,.005,0);world.add(road);
  const cross=new THREE.Mesh(new THREE.PlaneGeometry(12,420),roadMat);cross.rotation.x=-Math.PI/2;cross.position.set(0,.006,0);world.add(cross);
  for(let i=-18;i<=18;i+=6){box(world,2.8,.025,.16,0xe4d6a6,i,.025,0);box(world,.16,.025,2.8,0xe4d6a6,0,.026,i);}
  const sidewalk=mat(0xb7b3a7);for(const side of [-1,1]){const walk=new THREE.Mesh(new THREE.PlaneGeometry(420,3),sidewalk);walk.rotation.x=-Math.PI/2;walk.position.set(side*7.7,.015,0);world.add(walk);}
  const facade=[0x587f91,0x8b6b83,0x9b805e,0x557f70,0x64769b,0x9a6657,0x6c7891,0x8c8d68];
  for(let z=-100;z<=100;z+=34){for(let x=-100;x<=100;x+=34){if(Math.abs(x)<24&&Math.abs(z)<24)continue;const w=12+(Math.abs(x+z)%5),d=12+(Math.abs(x-z)%5),h=9+(Math.abs(x*z)%13);const c=facade[Math.abs(Math.floor((x+z)/34))%facade.length];box(world,w,h,d,c,x,h/2,z);box(world,w+.3,.45,d+.3,0x354252,x,h+.2,z);for(let floorNo=1;floorNo<Math.floor(h/3);floorNo++){for(const side of [-1,1]){box(world,1.25,1.25,.08,0x9bd0d9,x+side*w*.27,floorNo*2.6,z-d/2-.05);box(world,.08,1.25,1.25,0x9bd0d9,x-w/2-.05,floorNo*2.6,z+side*d*.27);}}}}
  // town square and market lane
  box(world,18,.22,12,0x9b9b91,0,0,-15); box(world,7,.08,52,0xb5a98e,0,.02,0);
  for(let i=0;i<5;i++){const x=-24+i*12; box(world,7,4+(i%3),7,[0x587f91,0x8b6b83,0x9b805e,0x557f70,0x64769b][i],x,2,-28); box(world,7.2,.35,7.2,0x343f50,x,4.1+(i%3),-28);}
  for(let i=0;i<4;i++){const x=-18+i*12; box(world,5,2.4,2,0x526c87,x,1.2,14); box(world,5,.18,2.1,0xe0b66b,x,2.5,14);}
  // benches, crates, lamps, flower beds
  for(let i=0;i<6;i++){const x=-20+i*8; box(world,2.4,.25,.55,0x79563c,x,.65,7); box(world,.18,.6,.18,0x3c4850,x-1,.3,7);box(world,.18,.6,.18,0x3c4850,x+1,.3,7);}
  for(let i=0;i<28;i++){const x=Math.sin(i*2.2)*((i%3)*18+42),z=Math.cos(i*2.2)*((i%3)*18+42);box(world,1.3,1.3,1.3,0x8a6749,x,.65,z);const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.22,.32,2.8,7),mat(0x684c38));trunk.position.set(x,1.4,z);world.add(trunk);const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(2.1,1),mat([0x39765c,0x4d895c,0x668b56][i%3]));crown.position.set(x,3.5,z);world.add(crown);}
  for(let i=0;i<18;i++){const x=-78+i*9;const pole=new THREE.Mesh(new THREE.CylinderGeometry(.08,.12,4,8),mat(0x37404a));pole.position.set(x,2,-8);world.add(pole);const lamp=new THREE.Mesh(new THREE.SphereGeometry(.24,10,8),new THREE.MeshStandardMaterial({color:0xffe5a2,emissive:0xffb54a,emissiveIntensity:.8}));lamp.position.set(x,4,-8);world.add(lamp);}
}
buildWorld();

function makeAvatar(color:number, outfit='casual'):Avatar{
 const root=new THREE.Group();
 const skin=mat(0xe8b995), cloth=mat(color), pants=mat(outfit==='guard'?0x303c4a:0x202b3d), shoes=mat(0x151c28), hair=mat(0x30251f), dark=mat(0x231b1b);
 const torso=new THREE.Group(); torso.position.y=1.43; root.add(torso);
 const body=new THREE.Mesh(new THREE.CapsuleGeometry(.38,.55,4,8),cloth);body.scale.set(1,.94,.62);body.position.y=.05;torso.add(body);
 // neck and head with eyes, brows, nose, mouth, ears and hair
 const neck=new THREE.Mesh(new THREE.CylinderGeometry(.12,.14,.22,8),skin);neck.position.y=.54;torso.add(neck);
 const head=new THREE.Group();head.position.set(0,.91,0);torso.add(head);
 const skull=new THREE.Mesh(new THREE.SphereGeometry(.31,16,12),skin);skull.scale.set(.91,1.12,.88);head.add(skull);
 const faceZ=-.27;
 for(const x of [-.105,.105]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.043,10,8),mat(0xf8f5ed));eye.position.set(x,.035,faceZ);head.add(eye);const pupil=new THREE.Mesh(new THREE.SphereGeometry(.022,8,6),mat(0x292b31));pupil.position.set(x,.035,faceZ-.035);head.add(pupil);const brow=new THREE.Mesh(new THREE.BoxGeometry(.105,.025,.035),hair);brow.position.set(x,.105,faceZ+.005);head.add(brow);}
 const nose=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),skin);nose.scale.set(.72,1,.8);nose.position.set(0,-.035,faceZ-.035);head.add(nose);
 const mouth=new THREE.Mesh(new THREE.BoxGeometry(.105,.018,.018),mat(0x824b4b));mouth.position.set(0,-.13,faceZ-.005);head.add(mouth);
 for(const x of [-.29,.29]){const ear=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),skin);ear.position.set(x,-.015,0);head.add(ear);}
 const cap=new THREE.Mesh(new THREE.SphereGeometry(.305,12,8,0,Math.PI*2,0,Math.PI*.55),hair);cap.position.y=.12;head.add(cap);
 // articulated limbs
 function limb(x:number,y:number,isArm:boolean){const pivot=new THREE.Group();pivot.position.set(x,y,0);root.add(pivot);const length=isArm?.62:.72;const upper=new THREE.Mesh(new THREE.CapsuleGeometry(isArm?.115:.145,length*.42,4,8),isArm?cloth:pants);upper.position.y=-length*.38;pivot.add(upper);const joint=new THREE.Mesh(new THREE.SphereGeometry(isArm?.105:.13,8,6),isArm?skin:pants);joint.position.y=-length*.72;pivot.add(joint);const lower=new THREE.Mesh(new THREE.CapsuleGeometry(isArm?.095:.12,length*.35,4,8),isArm?skin:pants);lower.position.y=-length*.98;pivot.add(lower);if(!isArm){const shoe=new THREE.Mesh(new THREE.BoxGeometry(.25,.14,.38),shoes);shoe.position.set(0,-length*1.27,-.07);pivot.add(shoe);}return pivot;}
 const leftArm=limb(-.45,1.87,true),rightArm=limb(.45,1.87,true),leftLeg=limb(-.19,.93,false),rightLeg=limb(.19,.93,false);
 // accessories: simple backpack
 const pack=box(root,.43,.55,.2,0x3b5366,0,1.48,.31);pack.rotation.x=-.08;
 return {root,leftArm,rightArm,leftLeg,rightLeg};
}
const player=makeAvatar(0x43cbb7);scene.add(player.root);
const petGroup=new THREE.Group();scene.add(petGroup);let petMixer:THREE.AnimationMixer|null=null;let petWalk:THREE.AnimationAction|null=null;let petIdle:THREE.AnimationAction|null=null;let petReady=false;let petTarget=new THREE.Vector3(13,0,18);let petPhase=0;
const petLoader=new GLTFLoader();petLoader.load('https://gobkit.com/freebies/animal/Corgi.glb',g=>{const dog=g.scene;const bounds=new THREE.Box3().setFromObject(dog);const size=bounds.getSize(new THREE.Vector3());dog.scale.setScalar(1.15/Math.max(size.y,.001));dog.position.y=0;dog.rotation.y=Math.PI;dog.traverse(o=>{if((o as THREE.Mesh).isMesh){(o as THREE.Mesh).castShadow=true;(o as THREE.Mesh).receiveShadow=true;}});petGroup.add(dog);petMixer=new THREE.AnimationMixer(dog);if(g.animations[0]){const idle=THREE.AnimationUtils.subclip(g.animations[0],'idle',0,30,24);const walk=THREE.AnimationUtils.subclip(g.animations[0],'walk',90,120,24);petIdle=petMixer.clipAction(idle);petWalk=petMixer.clipAction(walk);petIdle.play();}petReady=true;},undefined,()=>console.warn('Optional CC0 dog model failed to load; world remains playable.'));
const bots:Bot[]=[];const botColors=[0xff795f,0xffc857,0x9c83ff,0x70a7ff,0xe77ea9,0x91c46b,0xd19b6d,0x69b7c7,0xd98d54,0x65a9a0,0xb17ca1,0xc3b36d];
const jobs=[{role:'shopkeeper',route:[[-13,-15],[-13,-15],[-13,-15]]},{role:'courier',route:[[5,-8],[35,-8],[35,28],[5,28]]},{role:'gardener',route:[[-36,35],[-52,35],[-52,55],[-36,55]]},{role:'builder',route:[[40,-40],[58,-40],[58,-20],[40,-20]]},{role:'guard',route:[[0,-28],[0,28],[28,28],[28,-28]]},{role:'citizen',route:[[-30,-20],[-30,22],[25,22],[25,-20]]},{role:'vendor',route:[[14,14],[14,14],[14,14]]},{role:'cleaner',route:[[-20,0],[-20,22],[20,22],[20,0]]},{role:'student',route:[[48,48],[62,48],[62,62],[48,62]]},{role:'mechanic',route:[[70,5],[88,5],[88,22],[70,22]]},{role:'dog walker',route:[[-75,-20],[-60,-20],[-60,-38],[-75,-38]]},{role:'resident',route:[[80,-55],[98,-55],[98,-35],[80,-35]]}];
for(let i=0;i<jobs.length;i++){const a=makeAvatar(botColors[i]);const job=jobs[i];const route=job.route.map(p=>new THREE.Vector3(p[0],0,p[1]));a.root.userData.limbs=[a.leftArm,a.rightArm,a.leftLeg,a.rightLeg];a.root.position.copy(route[0]);scene.add(a.root);bots.push({root:a.root,hp:100,alive:true,respawn:0,phase:i*1.7,state:'wander',target:route[0].clone(),mood:i%4,speed:job.role==='courier'?2.8:1.1+(i%3)*.35,color:botColors[i],role:job.role,route,waypoint:1,work:0});}
const remotes=new Map<string,{avatar:Avatar;target:THREE.Vector3;name:string}>();
const keys=new Set<string>(),playerPos=new THREE.Vector3(0,0,5),raycaster=new THREE.Raycaster(),clock=new THREE.Clock();
let yaw=0,pitch=-.12,vy=0,health=100,kills=0,playing=false,pointerLocked=false,fireCooldown=0,network:WebSocket|null=null,ownId='',joystick={x:0,y:0},touchLook=false,lastTouchX=0,lastTouchY=0,lastNetSend=0,toastTimer=0,walkPhase=0;
let equipped='Blaster',quality='high',sensitivity=1,showInventory=false;
const showToast=(s:string)=>{toast.textContent=s;toast.classList.add('visible');toastTimer=2.4;};
function updateHealth(){healthFill.style.width=health+'%';healthText.textContent=String(Math.ceil(health));}
function setQuality(q:string){quality=q;const dpr=q==='low'?.85:q==='medium'?1.15:1.65;renderer.setPixelRatio(Math.min(devicePixelRatio,dpr));renderer.shadowMap.enabled=q==='high';renderer.shadowMap.type=THREE.PCFSoftShadowMap;sun.castShadow=q==='high';sun.shadow.mapSize.set(q==='high'?1024:256,q==='high'?1024:256);sun.shadow.camera.left=-55;sun.shadow.camera.right=55;sun.shadow.camera.top=55;sun.shadow.camera.bottom=-55;scene.traverse(o=>{if((o as THREE.Mesh).isMesh){(o as THREE.Mesh).castShadow=q==='high';(o as THREE.Mesh).receiveShadow=q==='high';}});renderer.setSize(innerWidth,innerHeight);$('quality-select').querySelectorAll('option').forEach(o=>(o as HTMLOptionElement).selected=(o as HTMLOptionElement).value===q);try{localStorage.setItem('vexora-quality',q);}catch{}}
function addRemote(p:RemotePlayer){if(p.id===ownId||remotes.has(p.id))return;const avatar=makeAvatar(p.color||0x70a7ff);avatar.root.position.set(p.x,p.y,p.z);scene.add(avatar.root);remotes.set(p.id,{avatar,target:new THREE.Vector3(p.x,p.y,p.z),name:p.name});}
function connect(){const url=(import.meta as ImportMeta & {env:{VITE_WS_URL?:string}}).env.VITE_WS_URL;if(!url){netStatus.textContent='PRACTICE';return;}try{network=new WebSocket(url);network.onopen=()=>{netStatus.textContent='ONLINE';network?.send(JSON.stringify({type:'hello',name:nameInput.value}));};network.onmessage=e=>{let m:ServerMessage;try{m=JSON.parse(e.data) as ServerMessage;}catch{return;}if(m.type==='welcome'){ownId=m.id||'';(m.players||[]).forEach(addRemote);}if(m.type==='join'&&m.player)addRemote(m.player);if(m.type==='move'&&m.player){const r=remotes.get(m.player.id);if(r)r.target.set(m.player.x,m.player.y,m.player.z);else addRemote(m.player);}if(m.type==='leave'&&m.id){const r=remotes.get(m.id);if(r)scene.remove(r.avatar.root);remotes.delete(m.id);}};network.onclose=()=>netStatus.textContent='DISCONNECTED';network.onerror=()=>netStatus.textContent='CONNECTION ERROR';}catch{netStatus.textContent='PRACTICE';}}
function start(){if(playing)return;playing=true;startScreen.classList.add('hidden');gameUI.classList.remove('hidden');playerPos.set(0,0,5);health=100;updateHealth();connect();if(!/Mobi|Android/i.test(navigator.userAgent))canvas.requestPointerLock?.();showToast('Welcome to VEXORA! Explore the town.');}
function leave(){playing=false;document.exitPointerLock?.();network?.close();network=null;gameUI.classList.add('hidden');startScreen.classList.remove('hidden');}
function fire(){if(!playing||fireCooldown>0)return;fireCooldown=equipped==='Blaster'?.24:.48;const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).normalize();raycaster.set(camera.position,dir);raycaster.far=equipped==='Blaster'?48:3.2;const hits=raycaster.intersectObjects(bots.filter(b=>b.alive).map(b=>b.root),true);if(hits.length){const b=bots.find(b=>b.alive&&b.root===hits[0].object.parent?.parent?.parent?.parent)||bots.find(b=>b.alive&&b.root.getObjectById(hits[0].object.id));if(b){b.hp-=equipped==='Blaster'?50:25;if(b.hp<=0){b.alive=false;b.root.visible=false;b.respawn=5;kills++;killsText.textContent=String(kills);showToast('NPC defeated +1');}}}}
function damage(n:number){health=Math.max(0,health-n);updateHealth();if(!health){playerPos.set(0,0,5);health=100;updateHealth();showToast('You respawned at the town square.');}}
function look(dx:number,dy:number){yaw-=dx*.003*sensitivity;pitch=THREE.MathUtils.clamp(pitch-dy*.0025*sensitivity,-.9,.5);}
document.addEventListener('keydown',e=>{keys.add(e.code);if(['Space','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();if(e.code==='KeyE')interact();if(e.code==='KeyI')toggleInventory();if(e.code==='Escape'&&playing) $('settings-panel').classList.toggle('hidden');});
document.addEventListener('keyup',e=>keys.delete(e.code));document.addEventListener('pointerlockchange',()=>pointerLocked=document.pointerLockElement===canvas);document.addEventListener('mousemove',e=>{if(pointerLocked&&playing)look(e.movementX,e.movementY);});
canvas.addEventListener('click',()=>{if(playing&&!pointerLocked&&!/Mobi|Android/i.test(navigator.userAgent))canvas.requestPointerLock?.();else fire();});
$('play-btn').addEventListener('click',start);$('leave-btn').addEventListener('click',leave);
$('fire-btn').addEventListener('pointerdown',e=>{e.preventDefault();fire();});$('jump-btn').addEventListener('pointerdown',e=>{e.preventDefault();if(playerPos.y<.03)vy=7;});
$('sound-btn').addEventListener('click',()=>showToast('Sound options coming in a future update.'));
$('settings-btn').addEventListener('click',()=>$('settings-panel').classList.toggle('hidden'));
$('close-settings').addEventListener('click',()=>$('settings-panel').classList.add('hidden'));
$('inventory-btn').addEventListener('click',toggleInventory);$('close-inventory').addEventListener('click',toggleInventory);
$('quality-select').addEventListener('change',e=>setQuality((e.target as HTMLSelectElement).value));
$('fov-range').addEventListener('input',e=>{camera.fov=Number((e.target as HTMLInputElement).value);camera.updateProjectionMatrix();$('fov-value').textContent=String(camera.fov);});
$('sensitivity-range').addEventListener('input',e=>{sensitivity=Number((e.target as HTMLInputElement).value)/100;$('sensitivity-value').textContent=(sensitivity*100).toFixed(0)+'%';});
$('equip-select').addEventListener('change',e=>{equipped=(e.target as HTMLSelectElement).value;showToast(equipped+' equipped');});
$('interact-btn').addEventListener('pointerdown',e=>{e.preventDefault();interact();});$('interact-btn-mobile').addEventListener('pointerdown',e=>{e.preventDefault();interact();});
function toggleInventory(){showInventory=!showInventory;$('inventory-panel').classList.toggle('hidden',!showInventory);}
function interact(){if(!playing)return;let nearest:Bot|null=null,dist=4;for(const b of bots){if(!b.alive)continue;const d=b.root.position.distanceTo(playerPos);if(d<dist){nearest=b;dist=d;}}showToast(nearest?'NPC: '+['Hello!','Nice weather today.','Want to train?','Stay alert!'][Math.floor(Math.random()*4)]:'No one nearby. Explore the town!');}
canvas.addEventListener('touchstart',e=>{if(!playing)return;const t=e.changedTouches[0];if(t.clientX>innerWidth*.42){touchLook=true;lastTouchX=t.clientX;lastTouchY=t.clientY;}},{passive:true});
canvas.addEventListener('touchmove',e=>{if(!touchLook)return;const t=e.changedTouches[0];look(t.clientX-lastTouchX,t.clientY-lastTouchY);lastTouchX=t.clientX;lastTouchY=t.clientY;},{passive:true});canvas.addEventListener('touchend',()=>touchLook=false);
const joy=$('joystick'),stick=$('stick');joy.addEventListener('pointerdown',e=>{joy.setPointerCapture(e.pointerId);updateJoy(e);});joy.addEventListener('pointermove',e=>{if(e.buttons)updateJoy(e);});joy.addEventListener('pointerup',()=>{joystick={x:0,y:0};stick.style.transform='translate(0,0)';});
function updateJoy(e:PointerEvent){const r=joy.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,len=Math.max(1,Math.hypot(dx,dy)),s=Math.min(1,40/len);joystick={x:dx/len*s,y:dy/len*s};stick.style.transform=`translate(${joystick.x*40}px,${joystick.y*40}px)`;}
function animateAvatar(a:Avatar,phase:number,moving:boolean,working=false){const swing=moving?Math.sin(phase)*.62:Math.sin(phase*1.4)*.035;a.leftArm.rotation.x=working?-.9:swing*.75;a.rightArm.rotation.x=working?-.65:-swing*.75;a.leftLeg.rotation.x=-swing;a.rightLeg.rotation.x=swing;}
function update(dt:number){
 if(!playing)return;fireCooldown=Math.max(0,fireCooldown-dt);toastTimer-=dt;if(toastTimer<=0)toast.classList.remove('visible');
 const f=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-joystick.y,s=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+joystick.x;
 const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),move=forward.multiplyScalar(f).addScaledVector(right,s);if(move.lengthSq()>1)move.normalize();
 const sprint=keys.has('ShiftLeft')||keys.has('ShiftRight'),crouch=keys.has('ControlLeft');const speed=crouch?3.1:sprint?12:7.5;playerPos.addScaledVector(move,speed*dt);playerPos.x=THREE.MathUtils.clamp(playerPos.x,-195,195);playerPos.z=THREE.MathUtils.clamp(playerPos.z,-195,195);
 if(keys.has('Space')&&playerPos.y<.03)vy=7;vy-=18*dt;playerPos.y=Math.max(0,playerPos.y+vy*dt);if(!playerPos.y)vy=0;
 player.root.position.copy(playerPos);player.root.rotation.y=yaw;const moving=move.lengthSq()>.01;if(moving)walkPhase+=dt*(sprint?13:8);animateAvatar(player,walkPhase,moving);player.root.scale.y=crouch?.82:1;
 for(const b of bots){
  if(!b.alive){b.respawn-=dt;if(b.respawn<=0){b.alive=true;b.hp=100;b.root.visible=true;b.root.position.copy(b.route[0]);b.waypoint=1;b.work=0;}continue;}
  b.phase+=dt;
  // NPCs follow assigned lives and routes. They do not target or chase the player.
  const workRole=['shopkeeper','vendor','builder','gardener','mechanic','cleaner'].includes(b.role);
  if(workRole){b.work+=dt;if(b.work>7){b.work=0;b.waypoint=(b.waypoint+1)%b.route.length;}}
  const goal=b.route[b.waypoint]||b.route[0];const dx=goal.x-b.root.position.x,dz=goal.z-b.root.position.z,dist=Math.hypot(dx,dz);
  let moving=false;
  if(dist>.65){const step=Math.min(dist,b.speed*dt);b.root.position.x+=dx/dist*step;b.root.position.z+=dz/dist*step;b.root.rotation.y=Math.atan2(-dx,-dz);moving=true;}
  else if(!workRole){b.work+=dt;if(b.work>2.5){b.work=0;b.waypoint=(b.waypoint+1)%b.route.length;}}
  else {b.root.rotation.y=Math.sin(b.phase*.45)*.35; }
  // small job-specific motions: sweeping, gardening, building, serving and shop idles
  const isWorking=!moving&&workRole;
  const swing=moving?Math.sin(b.phase*7)*.55:0;
  const limbs=(b.root.userData.limbs||[]) as THREE.Group[];
  if(limbs.length>=4){(limbs[0] as THREE.Group).rotation.x=isWorking?Math.sin(b.phase*3)*.65:swing*.7;(limbs[1] as THREE.Group).rotation.x=isWorking?-.5:-swing*.7;(limbs[2] as THREE.Group).rotation.x=-swing;(limbs[3] as THREE.Group).rotation.x=swing;}
  b.root.position.y=moving?Math.abs(Math.sin(b.phase*8))*.055:Math.sin(b.phase*2)*.012;
 }
 animateAvatar(player,walkPhase,moving);
 for(const r of remotes.values())r.avatar.root.position.lerp(r.target,Math.min(1,dt*12));
 if(petReady){petPhase+=dt;const dog=petGroup.children[0];if(dog){const d=petTarget.clone().sub(dog.position);if(d.length()<1){petTarget.set(Math.sin(petPhase*.23)*38,0,Math.cos(petPhase*.19)*38);}else{d.normalize();dog.position.addScaledVector(d,dt*1.8);dog.rotation.y=Math.atan2(d.x,d.z);if(petWalk&&!petWalk.isRunning()){petIdle?.stop();petWalk.reset().play();}}if(petMixer)petMixer.update(dt);}}
 const target=new THREE.Vector3(playerPos.x,playerPos.y+1.45,playerPos.z),offset=new THREE.Vector3(Math.sin(yaw)*5.8,2.9+pitch*2,Math.cos(yaw)*5.8);camera.position.lerp(target.clone().add(offset),1-Math.exp(-dt*9));camera.lookAt(target);
 if(network?.readyState===WebSocket.OPEN&&performance.now()-lastNetSend>65){network.send(JSON.stringify({type:'move',x:playerPos.x,y:playerPos.y,z:playerPos.z,yaw}));lastNetSend=performance.now();}
 playersText.textContent=String(1+remotes.size+bots.filter(b=>b.alive).length);
}
function render(){requestAnimationFrame(render);const dt=Math.min(clock.getDelta(),.04);update(dt);if(!playing){camera.position.set(Math.sin(clock.elapsedTime*.12)*30,19,36);camera.lookAt(0,0,0);}renderer.render(scene,camera);}
render();addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);setQuality(quality);});
try{setQuality(localStorage.getItem('vexora-quality')||'high');}catch{setQuality('high');}
