import {getTerrainAt } from '/game/utils';
import {Creep,StructureSpawn,StructureRoad} from '/game/prototypes';
import {ATTACK,RANGED_ATTACK,HEAL,WORK,CARRY,MOVE,TERRAIN_WALL} from '/game/constants';
import { } from '/arena';
import {Visual} from '/game/visual';
import {CostMatrix,searchPath} from '/game/path-finder';
import { getObjectsByPrototype,getRange,getTicks } from '/game/utils';

class creep_profiler{

	constructor(creep){
		this.lastPos={x:creep.x,y:creep.y}
		this.lastMoveTick
		let moveCount = creep.body.filter(b=>b.type==MOVE).length
		let otherCount = creep.body.filter(b=>b.type!=MOVE&&b.type!=CARRY).length

		this.moveTickSwamp = Math.ceil(otherCount/moveCount*5)
		this.moveTickPlane = Math.ceil(otherCount/moveCount)

		console.log(this.moveTickSwamp,this.moveTickPlane)
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

let isInit,sideLeft

export let centerArea,enemySpawnArea,mySpawnArea

function rect(x,y,w,h){
	const rect = {x:x,y:y,w:w,h:h}
	rect.contain = function(pos){

	}
	return rect
}

function init(){
	spawn = getObjectsByPrototype(StructureSpawn).find(spawn=>!spawn.my)
	sideLeft = spawn.x<50

	centerArea = rect(14,0,71,99)
	if(sideLeft){
		enemySpawnArea = rect(0,19,13,61)
		mySpawnArea = rect(86,19,13,61)
	}else{
		mySpawnArea = rect(0,19,13,61)
		enemySpawnArea = rect(86,19,13,61)
	}
	
}

export function update(){
	if(!isInit){
        init();
        isInit=true;
    }
	
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
    visual.rect(centerArea,centerArea.w,centerArea.h,{opacity:0.1})
    visual.rect(mySpawnArea,mySpawnArea.w,mySpawnArea.h,{opacity:0.1,fill:'#00f000'})
    visual.rect(enemySpawnArea,enemySpawnArea.w,enemySpawnArea.h,{opacity:0.1,fill:'#f00000'})

    //敵陣地
    visual.circle(spawn,{radius:8,opacity:0.1,fill:'#F00000'})
    rangedAttackers.forEach(creep=>{
    	visual.circle(creep,{radius:3,opacity:0.1,fill:'#F00000'})
    })

}