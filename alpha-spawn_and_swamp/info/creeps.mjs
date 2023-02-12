import {getObjectsByPrototype} from '/game/utils';
import {Creep,StructureSpawn,OwnedStructure} from '/game/prototypes';
import {ATTACK,RANGED_ATTACK,HEAL,MOVE,CARRY} from '/game/constants';
import { } from '/arena';

import * as maps from './maps';

export let creeps = []
export let ownedStructures
export let spawn

export function update(){
	//死亡イベントをフラグ
	creeps.filter(creep=>creep.hitsMax==null).forEach(creep=>{
		if(creep.onDeath!=null)
			creep.onDeath()
	})
	creeps = getObjectsByPrototype(Creep).filter(creep=>creep.my)
	creeps.forEach(creep=>{
		if(!creep.profiler)
			creep.profiler = new creep_profiler(creep)
		creep.profiler.update(creep)
	})

	ownedStructures = getObjectsByPrototype(OwnedStructure)
	spawn = getObjectsByPrototype(StructureSpawn).find(os=>os.my)
}

class creep_profiler{

	constructor(creep){
		//移動計測用
		this.lastPos={x:creep.x,y:creep.y}
		this.weight
	}
	update(creep){

		const moveLastTick = creep.x!=this.lastPos.x||creep.y!=this.lastPos.y

		//機動力計測
		let moveCount = creep.body.filter(b=>b.type==MOVE&&0<b.hits).length
		let otherCount = creep.body.filter(b=>b.type!=MOVE&&b.type!=CARRY&&0<b.hits).length

		creep.moveTickSwamp = Math.ceil(otherCount/moveCount*5)
		creep.moveTickPlane = Math.ceil(otherCount/moveCount)
		creep.canMove = creep.fatigue <= 0 && 0 < moveCount
		creep.moveTimer = Math.ceil(creep.fatigue / moveCount / 2)

		//イベントフラグ
		if(moveLastTick&&creep.onEnterCenter!=null&&!maps.centerArea.contain(this.lastPos)&&maps.centerArea.contain(creep)){
			creep.onEnterCenter()
		}

		this.lastPos = {x:creep.x,y:creep.y}
	}
}