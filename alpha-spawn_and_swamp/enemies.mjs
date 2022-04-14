import { } from '/game/utils';
import {Creep,StructureSpawn} from '/game/prototypes';
import {ATTACK,RANGED_ATTACK,HEAL} from '/game/constants';
import { } from '/arena';

import { getObjectsByPrototype } from '/game/utils';

class creep_profiler{

	constructor(){
		this.lastPos
		this.lastMoveTick
		this.moveSpeed
		this.weight
	}
}

export let spawn
export let creeps=[]
export let attacker=[]
export let rangeAttacker=[]
export let healer=[]
export let worker=[]
export let soldier=[]

export function update(){
	
	spawn = getObjectsByPrototype(StructureSpawn).find(spawn=>!spawn.my)
	creeps = getObjectsByPrototype(Creep).filter(creep=>!creep.my&&creep.hits!=null)
	creeps.forEach(creep=>{
		if(!creep.profiler)
			creep.profiler = new creep_profiler()
	})

    attacker = creeps.filter(creep=>creep.body.some(b=>b.type==ATTACK))
    rangeAttacker = creeps.filter(creep=>creep.body.some(b=>b.type==RANGED_ATTACK))
    healer = creeps.filter(creep=>creep.body.some(b=>b.type==HEAL))

    soldier = creeps.filter(creep=>creep.body.some(b=>b.type==RANGED_ATTACK||b.type==ATTACK))
    worker = creeps.filter(creep=>creep.body.some(b=>b.type!=RANGED_ATTACK&&b.type!=ATTACK))



}