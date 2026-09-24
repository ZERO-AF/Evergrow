import { vendorIdentity, vendorEmblem } from './vendor-identity.ts';
import { type TownNPC, NPC_NAMES, NPC_COLORS } from './npcs.ts';
import { drawHumanoid } from './art.ts';
import { UNARMED_WEAPON } from './equipment.ts';
import { SKIN_PALETTES, HAIR_PALETTES, HAIR_STYLES, FACIAL_HAIR, ACCESSORIES } from './appearance-content.ts';
import { text } from './font.ts';
import type { CharacterPose, ArmorPiece } from './art-types.ts';
import type { Resident } from './settlement-residents.ts';
const looks=new Map<number,Pick<CharacterPose,'appearance'|'outfit'>>();
function npcLook(seed:number,role:string):Pick<CharacterPose,'appearance'|'outfit'>{
  const key=seed,old=looks.get(key);if(old)return old;
  const colors=['#68775b','#756246','#646887','#825552','#426b66','#78717d','#8a784f','#4e6579'];
  const base=vendorIdentity(role)?.cloth??colors[seed%colors.length];
  const piece=(salt:number,style:'cloth'|'leather'='cloth'):ArmorPiece=>({seed:seed+salt,style,material:{surface:style==='cloth'?'cloth':'leather',base,shadow:'#283338',edge:'#a1997d',trim:'#baa476'}});
  const result={appearance:{skin:SKIN_PALETTES[seed%SKIN_PALETTES.length].id,hairColor:HAIR_PALETTES[(seed>>>4)%HAIR_PALETTES.length].id,hair:HAIR_STYLES[(seed>>>8)%HAIR_STYLES.length].id,facialHair:FACIAL_HAIR[(seed>>>13)%FACIAL_HAIR.length].id,accessory:ACCESSORIES[(seed>>>17)%ACCESSORIES.length].id},
    outfit:{head:null,chest:piece(1,role==='blacksmith'?'leather':'cloth'),shoulders:null,hands:null,legs:piece(2),boots:piece(3,'leather'),cloak:seed%3===0?{base,shadow:'#243238',highlight:'#9a977d',trim:'#b49a6a',seed}:null}};
  if(looks.size>=128)looks.delete(looks.keys().next().value!);looks.set(key,result);return result;
}
/** Keep civilian bodies and their ground shadows at the same scale. */
export function npcArtScale(npc:TownNPC|Resident):number{return 'household' in npc && npc.child ? .72 : 1;}
/** Merchants and families use the same full procedural body, face, hair, clothes and gait as players. */
export function drawNPC(c:CanvasRenderingContext2D,npc:TownNPC|Resident,time:number,reduced=false):void{
  if('role'in npc&&npc.role==='stash')return;
  const resident='household'in npc,role='role'in npc?npc.role:'resident';
  const look=npcLook(npc.seed,role);
  c.save();c.translate(npc.x,npc.y);const scale=npcArtScale(npc);c.scale(scale,scale);
  // Service folk carry a faint warm halo at their feet — the WoW "you can talk
  // to me" cue — while residents stay unlit.
  if(!resident){
    const breathe=.5+.5*Math.sin((reduced?0:time)*1.6+npc.seed);
    c.save();c.globalCompositeOperation='screen';c.globalAlpha=.10+breathe*.05;
    const g=c.createRadialGradient(0,-4,0,0,-4,26);
    g.addColorStop(0,'#ffd9a0');g.addColorStop(1,'#ffd9a000');c.fillStyle=g;
    c.beginPath();c.ellipse(0,-4,26,10,0,0,Math.PI*2);c.fill();c.restore();
  }
  drawHumanoid(c,{kind:'player',...look,appearance:resident&&npc.child?{...look.appearance!,facialHair:'none'}:look.appearance,
    angle:npc.angle??Math.PI/2,time:reduced?0:time+npc.seed%37,moving:reduced?0:(npc.moving??0),
    gaitPhase:time*2.2,attack:0,attackAngle:Math.PI/2,weapon:UNARMED_WEAPON.visual,offHand:null,hitFlash:0,dodging:false});
  c.restore();
  // WoW-style always-on nameplates: service NPCs carry their title, residents a dimmer name.
  c.save();c.translate(npc.x,npc.y);c.scale(scale,scale);
  const bob=resident?0:Math.sin((reduced?0:time)*1.6+npc.seed)*.8;
  if(resident){
    c.globalAlpha=.62;text(c,npc.name,0,-64,.78,'#d8dccb','center');
  }else{
    text(c,npc.name,0,-66+bob,.85,'#ece7d2','center');
    text(c,NPC_NAMES[(npc as TownNPC).role],0,-57+bob,.68,NPC_COLORS[(npc as TownNPC).role],'center');
  }
  c.restore();
}
export function npcEmblem(role:TownNPC['role']):string{return vendorEmblem(role);}
