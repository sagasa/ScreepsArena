import { } from '/game/utils';
import {Creep,StructureSpawn,StructureRoad} from '/game/prototypes';
import {ATTACK,RANGED_ATTACK,HEAL,WORK,CARRY,MOVE} from '/game/constants';
import { } from '/arena';
import {Visual} from '/game/visual';
import { getObjectsByPrototype,getRange,getTicks } from '/game/utils';

class creep_profiler{

	constructor(creep){
		this.lastPos={x:creep.x,y:creep.y}
		this.lastMoveTick
		let moveCount = creep.body.filter(b=>b.type==MOVE).length
		let otherCount = creep.body.filter(b=>b.type!=MOVE&&b.type!=CARRY).length

		console.log(moveCount,otherCount)
		this.moveTickSwamp
		this.moveTickPlane
		this.weight
	}
	update(creep){
		if(creep.x!=this.lastPos.x||creep.y!=this.lastPos.y){
			this.lastMoveTick = getTicks()
			console.log('move',this.lastMoveTick)
		}

		this.lastPos = {x:creep.x,y:creep.y}
	}
}

export let spawn
export let creeps=[]
export let attackers=[]
export let rangedAttackers=[]
export let healers=[]
export let workers=[]
export let transporters=[]
export let soldiers=[]

export function update(){
	
	spawn = getObjectsByPrototype(StructureSpawn).find(spawn=>!spawn.my)
	creeps = getObjectsByPrototype(Creep).filter(creep=>!creep.my&&creep.hits!=null)
	creeps.forEach(creep=>{
		if(!creep.profiler)
			creep.profiler = new creep_profiler(creep)
		creep.profiler.update(creep)
	})

    attackers = creeps.filter(creep=>creep.body.some(b=>b.type==ATTACK))
    rangedAttackers = creeps.filter(creep=>creep.body.some(b=>b.type==RANGED_ATTACK))
    healers = creeps.filter(creep=>creep.body.some(b=>b.type==HEAL))

    soldiers = creeps.filter(creep=>creep.body.some(b=>b.type==RANGED_ATTACK||b.type==HEAL||b.type==ATTACK))
    workers = creeps.filter(creep=>creep.body.some(b=>b.type==WORK))
    transporters = creeps.filter(creep=>creep.body.some(b=>b.type==CARRY))

    let visual = new Visual(0,false)

    //交戦エリア
    visual.rect({x:15,y:0},70,100)
    //敵陣地

    rangedAttackers.forEach(creep=>{
    	visual.circle(creep,{radius:3,opacity:0.1,fill:'#F00000'})
    })

}