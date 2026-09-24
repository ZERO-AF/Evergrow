import type { Enemy } from './model.ts';
/** Rebuilt once per fixed tick; moved actors update immediately to preserve AI ordering.
 * Cells are keyed by a packed integer (cx * 2^32 + cy) instead of a string —
 * the tick rebuild and every `around` query stay allocation-free. */
export class EnemyNeighbors {
  private cells=new Map<number,Enemy[]>();
  /** Cell key + rebuild order per enemy, packed into one map entry. */
  private slots=new Map<Enemy,{cell:number;order:number}>();
  private maxRadius=0;
  private scratch:Enemy[]=[];
  private key(x:number,y:number){return Math.floor(x/96)*4294967296+Math.floor(y/96);}
  rebuild(enemies:readonly Enemy[]){
    this.cells.clear();this.slots.clear();this.maxRadius=0;
    enemies.forEach((enemy,index)=>{if(enemy.state==='dead')return;this.slots.set(enemy,{cell:NaN,order:index});this.maxRadius=Math.max(this.maxRadius,enemy.radius);this.update(enemy);});
  }
  update(enemy:Enemy){
    const slot=this.slots.get(enemy);if(!slot)return;
    const next=this.key(enemy.x,enemy.y),old=slot.cell;
    if(old===next)return;
    if(!Number.isNaN(old)){const cell=this.cells.get(old)!;cell.splice(cell.indexOf(enemy),1);if(!cell.length)this.cells.delete(old);}
    let cell=this.cells.get(next);if(!cell){cell=[];this.cells.set(next,cell);}cell.push(enemy);slot.cell=next;
  }
  /** Result rides a reused scratch buffer; consume it before the next `around` call. */
  around(enemy:Enemy,padding:number):readonly Enemy[]{
    const radius=enemy.radius+this.maxRadius+padding,out=this.scratch;
    out.length=0;
    for(let y=Math.floor((enemy.y-radius)/96);y<=Math.floor((enemy.y+radius)/96);y++)for(let x=Math.floor((enemy.x-radius)/96);x<=Math.floor((enemy.x+radius)/96);x++){
      const cell=this.cells.get(x*4294967296+y);if(cell)out.push(...cell);
    }
    return out.sort((a,b)=>this.slots.get(a)!.order-this.slots.get(b)!.order);
  }
}
