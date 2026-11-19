import * as THREE from 'three';
import './style.css';

type Bot = { root: THREE.Group; hp: number; alive: boolean; respawn: number; phase: number; state: 'wander'|'approach'|'retreat'|'guard'; target: THREE.Vector3; mood: number; speed: number; color: number; };
type Avatar = { root: THREE.Group; leftArm: THREE.Group; rightArm: THREE.Group; leftLeg: THREE.Group; rightLeg: THREE.Group; };
type RemotePlayer = { id:string; name:string; x:number; y:number; z:number; yaw:number; color:number };
type ServerMessage = { type:string; id?:string; players?:RemotePlayer[]; player?:RemotePlayer };
const $ = <T extends HTMLElement>(id:string) => document.getElementById(id) as T;
const canvas=$<HTMLCanvasElement>('game-canvas'), startScreen=$('start-screen'), gameUI=$('game-ui');
const nameInput=$<HTMLInputElement>('player-name'), healthFill=$('health-fill'), healthText=$('health-text'), killsText=$('kills'), playersText=$('players'), toast=$('toast'), netStatus=$('net-status');
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x9bc9e9); scene.fog=new THREE.Fog(0x9bc9e9,55,150);
const camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.1,240);
const renderer=new THREE.WebGLRenderer({canvas,antialias:!(/Mobi|Android/i.test(navigator.userAgent)),powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); renderer.setSize(innerWidth,innerHeight); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.08;
const hemi=new THREE.HemisphereLight(0xd9efff,0x52604f,2.0); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffe7c4,2.4); sun.position.set(-25,42,18); scene.add(sun);
const mat=(c:number,r=.88,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
const floor=new THREE.Mesh(new THREE.PlaneGeometry(180,180),mat(0x547568)); floor.rotation.x=-Math.PI/2; floor.position.y=-.08; scene.add(floor);
const grid=new THREE.GridHelper(160,80,0x91afa0,0x718e80); grid.position.y=-.065; scene.add(grid);
const world=new THREE.Group(); scene.add(world);
function box(parent:THREE.Object3D,w:number,h:number,d:number,c:number,x:number,y:number,z:number){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));m.position.set(x,y,z);parent.add(m);return m;}
function buildWorld(){
  // A small, layered town square with readable landmarks, paths and cover.
  box(world,18,.22,12,0x9b9b91,0,0,-15); box(world,7,.08,52,0xb5a98e,0,.02,0);
  for(let i=0;i<5;i++){const x=-24+i*12; box(world,7,4+(i%3),7,[0x587f91,0x8b6b83,0x9b805e,0x557f70,0x64769b][i],x,2,-28); box(world,7.2,.35,7.2,0x343f50,x,4.1+(i%3),-28);}
  for(let i=0;i<4;i++){const x=-18+i*12; box(world,5,2.4,2,0x526c87,x,1.2,14); box(world,5,.18,2.1,0xe0b66b,x,2.5,14);}
  // benches, crates, lamps, flower beds
  for(let i=0;i<6;i++){const x=-20+i*8; box(world,2.4,.25,.55,0x79563c,x,.65,7); box(world,.18,.6,.18,0x3c4850,x-1,.3,7);box(world,.18,.6,.18,0x3c4850,x+1,.3,7);}
  for(let i=0;i<10;i++){const x=Math.sin(i*2.2)*32,z=Math.cos(i*2.2)*32;box(world,1.3,1.3,1.3,0x8a6749,x,.65,z);const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.22,.32,2.8,7),mat(0x684c38));trunk.position.set(x,1.4,z);world.add(trunk);const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(2.1,1),mat([0x39765c,0x4d895c,0x668b56][i%3]));crown.position.set(x,3.5,z);world.add(crown);}
  for(let i=0;i<8;i++){const x=-28+i*8;const pole=new THREE.Mesh(new THREE.CylinderGeometry(.08,.12,4,8),mat(0x37404a));pole.position.set(x,2,-8);world.add(pole);const lamp=new THREE.Mesh(new THREE.SphereGeometry(.24,10,8),new THREE.MeshStandardMaterial({color:0xffe5a2,emissive:0xffb54a,emissiveIntensity:.8}));lamp.position.set(x,4,-8);world.add(lamp);}
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
const bots:Bot[]=[];const botColors=[0xff795f,0xffc857,0x9c83ff,0x70a7ff,0xe77ea9,0x91c46b,0xd19b6d,0x69b7c7];
for(let i=0;i<8;i++){const a=makeAvatar(botColors[i],i%3===0?'guard':'casual');a.root.position.set(Math.sin(i*2.4)*17,0,Math.cos(i*2.4)*17);scene.add(a.root);bots.push({root:a.root,hp:100,alive:true,respawn:0,phase:i*1.7,state:i%3===0?'guard':'wander',target:new THREE.Vector3(),mood:i%4,speed:1.1+(i%3)*.25,color:botColors[i]});}
const remotes=new Map<string,{avatar:Avatar;target:THREE.Vector3;name:string}>();
const keys=new Set<string>(),playerPos=new THREE.Vector3(0,0,5),raycaster=new THREE.Raycaster(),clock=new THREE.Clock();
let yaw=0,pitch=-.12,vy=0,health=100,kills=0,playing=false,pointerLocked=false,fireCooldown=0,network:WebSocket|null=null,ownId='',joystick={x:0,y:0},touchLook=false,lastTouchX=0,lastTouchY=0,lastNetSend=0,toastTimer=0,walkPhase=0;
let equipped='Blaster',quality='high',sensitivity=1,showInventory=false;
const showToast=(s:string)=>{toast.textContent=s;toast.classList.add('visible');toastTimer=2.4;};
function updateHealth(){healthFill.style.width=health+'%';healthText.textContent=String(Math.ceil(health));}
function setQuality(q:string){quality=q;const dpr=q==='low'?.85:q==='medium'?1.15:1.65;renderer.setPixelRatio(Math.min(devicePixelRatio,dpr));renderer.shadowMap.enabled=q==='high';sun.castShadow=q==='high';renderer.setSize(innerWidth,innerHeight);$('quality-select').querySelectorAll('option').forEach(o=>(o as HTMLOptionElement).selected=(o as HTMLOptionElement).value===q);try{localStorage.setItem('vexora-quality',q);}catch{}}
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
function animateAvatar(a:Avatar,phase:number,moving:boolean){const swing=moving?Math.sin(phase)*.55:0;a.leftArm.rotation.x=swing*.7;a.rightArm.rotation.x=-swing*.7;a.leftLeg.rotation.x=-swing;a.rightLeg.rotation.x=swing;}
function update(dt:number){
 if(!playing)return;fireCooldown=Math.max(0,fireCooldown-dt);toastTimer-=dt;if(toastTimer<=0)toast.classList.remove('visible');
 const f=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-joystick.y,s=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+joystick.x;
 const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),move=forward.multiplyScalar(f).addScaledVector(right,s);if(move.lengthSq()>1)move.normalize();
 const sprint=keys.has('ShiftLeft')||keys.has('ShiftRight'),crouch=keys.has('ControlLeft');const speed=crouch?3.1:sprint?12:7.5;playerPos.addScaledVector(move,speed*dt);playerPos.x=THREE.MathUtils.clamp(playerPos.x,-72,72);playerPos.z=THREE.MathUtils.clamp(playerPos.z,-72,72);
 if(keys.has('Space')&&playerPos.y<.03)vy=7;vy-=18*dt;playerPos.y=Math.max(0,playerPos.y+vy*dt);if(!playerPos.y)vy=0;
 player.root.position.copy(playerPos);player.root.rotation.y=yaw;const moving=move.lengthSq()>.01;if(moving)walkPhase+=dt*(sprint?13:8);animateAvatar(player,walkPhase,moving);player.root.scale.y=crouch?.82:1;
 for(const b of bots){if(!b.alive){b.respawn-=dt;if(b.respawn<=0){b.alive=true;b.hp=100;b.root.visible=true;b.root.position.set((Math.random()-.5)*48,0,(Math.random()-.5)*48);b.state='wander';}continue;}
 b.phase+=dt;const dx=playerPos.x-b.root.position.x,dz=playerPos.z-b.root.position.z,d=Math.hypot(dx,dz);
 // autonomous lightweight NPC decision loop: wander, approach, retreat, guard, greet/interact.
 if(b.state==='guard'){if(d<11)b.state='approach';}
 else if(b.state==='wander'&&d<13)b.state=b.mood===0?'approach':b.mood===1?'retreat':'guard';
 else if(b.state==='approach'&&d>19)b.state='wander';
 else if(b.state==='retreat'&&d>18)b.state='wander';
 let vx=0,vz=0;if(b.state==='wander'){if(Math.sin(b.phase*.22+b.mood)>-.2){vx=Math.sin(b.phase*.55+b.mood);vz=Math.cos(b.phase*.43+b.mood);} }
 if(b.state==='approach'&&d>2.5){vx=dx/Math.max(d,1);vz=dz/Math.max(d,1);}
 if(b.state==='retreat'&&d<17){vx=-dx/Math.max(d,1);vz=-dz/Math.max(d,1);}
 const len=Math.hypot(vx,vz)||1;b.root.position.x+=vx/len*b.speed*dt;b.root.position.z+=vz/len*b.speed*dt;if(vx||vz)b.root.rotation.y=Math.atan2(-vx,-vz);
 if(d<2.2&&b.state==='approach'&&Math.random()<dt*.45)damage(5);
 }
 animateAvatar(player,walkPhase,moving);
 for(const r of remotes.values())r.avatar.root.position.lerp(r.target,Math.min(1,dt*12));
 const target=new THREE.Vector3(playerPos.x,playerPos.y+1.45,playerPos.z),offset=new THREE.Vector3(Math.sin(yaw)*5.8,2.9+pitch*2,Math.cos(yaw)*5.8);camera.position.lerp(target.clone().add(offset),Math.min(1,dt*8));camera.lookAt(target);
 if(network?.readyState===WebSocket.OPEN&&performance.now()-lastNetSend>65){network.send(JSON.stringify({type:'move',x:playerPos.x,y:playerPos.y,z:playerPos.z,yaw}));lastNetSend=performance.now();}
 playersText.textContent=String(1+remotes.size+bots.filter(b=>b.alive).length);
}
function render(){requestAnimationFrame(render);const dt=Math.min(clock.getDelta(),.04);update(dt);if(!playing){camera.position.set(Math.sin(clock.elapsedTime*.12)*30,19,36);camera.lookAt(0,0,0);}renderer.render(scene,camera);}
render();addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);setQuality(quality);});
try{setQuality(localStorage.getItem('vexora-quality')||'high');}catch{setQuality('high');}
